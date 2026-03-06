import { NextApiRequest, NextApiResponse } from "next";
import { getSessionServer } from "@/utils/auth";
import { getMongoDb } from "@/utils/mongo";

const toNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const getPeriodStart = (period: "daily" | "weekly" | "monthly") => {
  const now = new Date();
  const start = new Date(now);

  if (period === "daily") {
    start.setHours(0, 0, 0, 0);
    return start;
  }

  if (period === "weekly") {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1; // Monday start
    start.setDate(start.getDate() - diff);
    start.setHours(0, 0, 0, 0);
    return start;
  }

  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  return start;
};

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

    const products = await productCollection.find(isPusat ? {} : { lokasi }).toArray();
    const buyPriceByProductId = new Map<string, number>(
      products.map((product: any) => [String(product._id), toNumber(product.buyPrice, 0)])
    );

    const summarizePeriod = async (period: "daily" | "weekly" | "monthly") => {
      const startDate = getPeriodStart(period);
      const invoices = await invoiceCollection
        .find({
          ...(isPusat ? {} : { lokasi }),
          createdAt: { $gte: startDate },
        })
        .toArray();

      const sales = invoices.reduce((sum: number, invoice: any) => sum + toNumber(invoice.grandTotal), 0);
      const profit = invoices.reduce((sum: number, invoice: any) => {
        const items = Array.isArray(invoice.items) ? invoice.items : [];
        const invoiceProfit = items.reduce((itemSum: number, item: any) => {
          const qty = toNumber(item.quantity);
          const sell = toNumber(item.price);
          const buy = buyPriceByProductId.get(String(item.productId)) || 0;
          return itemSum + (sell - buy) * qty;
        }, 0);

        return sum + invoiceProfit;
      }, 0);

      return {
        sales,
        profit,
        invoiceCount: invoices.length,
      };
    };

    const [daily, weekly, monthly] = await Promise.all([
      summarizePeriod("daily"),
      summarizePeriod("weekly"),
      summarizePeriod("monthly"),
    ]);

    return res.status(200).json({
      periods: {
        daily,
        weekly,
        monthly,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to load sales summary:", error);
    }
    return res.status(500).json({ error: "Failed to load sales summary" });
  }
}
