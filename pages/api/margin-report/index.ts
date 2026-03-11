import { NextApiRequest, NextApiResponse } from "next";
import { getSessionServer } from "@/utils/auth";
import { getMongoDb } from "@/utils/mongo";

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatMonthKey = (date: Date) => `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const lokasi = typeof (session as any).lokasi === "string" && (session as any).lokasi.trim()
    ? (session as any).lokasi.trim()
     : "PUSAT";
  const isPusat = lokasi.toUpperCase() === "PUSAT";

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    const db = await getMongoDb();
    const invoiceCollection = db.collection("invoices");
    const productCollection = db.collection("Product");

    const [invoices, products] = await Promise.all([
      invoiceCollection.find(isPusat ? {} : { lokasi }).sort({ createdAt: -1 }).toArray(),
      productCollection.find(isPusat ? {} : { lokasi }).toArray(),
    ]);

    const buyPriceByProductId = new Map<string, number>(
      products.map((product: any) => [String(product._id), toNumber(product.buyPrice, toNumber(product.price, 0))])
    );

    const invoiceMargins = invoices.map((invoice: any) => {
      const items = Array.isArray(invoice.items) ? invoice.items : [];

      const margin = items.reduce((sum: number, item: any) => {
        const qty = toNumber(item.quantity);
        const sellPrice = toNumber(item.price);
        const buyPrice = buyPriceByProductId.get(String(item.productId)) || 0;
        return sum + (sellPrice - buyPrice) * qty;
      }, 0);

      return {
        id: String(invoice._id),
        invoiceNumber: invoice.invoiceNumber || "-",
        customerName: invoice.customerName || "Pelanggan",
        createdAt: new Date(invoice.createdAt).toISOString(),
        salesTotal: toNumber(invoice.grandTotal),
        margin,
      };
    });

    const monthlyMap = new Map<string, { month: string; invoiceCount: number; totalSales: number; totalMargin: number }>();

    invoiceMargins.forEach((invoice) => {
      const month = formatMonthKey(new Date(invoice.createdAt));
      const entry = monthlyMap.get(month) || {
        month,
        invoiceCount: 0,
        totalSales: 0,
        totalMargin: 0,
      };

      entry.invoiceCount += 1;
      entry.totalSales += invoice.salesTotal;
      entry.totalMargin += invoice.margin;
      monthlyMap.set(month, entry);
    });

    const monthlySummary = Array.from(monthlyMap.values()).sort((a, b) => b.month.localeCompare(a.month));

    const grandTotalMargin = invoiceMargins.reduce((sum, invoice) => sum + invoice.margin, 0);
    const grandTotalSales = invoiceMargins.reduce((sum, invoice) => sum + invoice.salesTotal, 0);

    return res.status(200).json({
      summary: {
        invoiceCount: invoiceMargins.length,
        grandTotalSales,
        grandTotalMargin,
      },
      monthlySummary,
      invoices: invoiceMargins,
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to load margin report:", error);
    }
    return res.status(500).json({ error: "Failed to load margin report" });
  }
}
