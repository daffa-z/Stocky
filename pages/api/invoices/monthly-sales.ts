import { NextApiRequest, NextApiResponse } from "next";
import { MongoClient } from "mongodb";
import { getSessionServer } from "@/utils/auth";

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const lokasi = typeof (session as any).lokasi === "string" && (session as any).lokasi.trim()
    ? (session as any).lokasi.trim()
     : "PUSAT";
  const isPusat = lokasi.toUpperCase() === "PUSAT";

  try {
    const mongoUri = process.env.DATABASE_URL;
    if (!mongoUri) {
      return res.status(500).json({ error: "DATABASE_URL is not configured" });
    }

    const client = new MongoClient(mongoUri);
    await client.connect();

    try {
      const dbName = new URL(mongoUri).pathname.replace("/", "") || undefined;
      const db = client.db(dbName);
      const invoiceCollection = db.collection("invoices");

      const invoices = await invoiceCollection.find(isPusat ? {} : { lokasi }).sort({ createdAt: -1 }).toArray();

      const monthlyMap = invoices.reduce(
        (acc, invoice: any) => {
          const createdAt = new Date(invoice.createdAt || new Date());
          const monthKey = `${createdAt.getFullYear()}-${String(createdAt.getMonth() + 1).padStart(2, "0")}`;

          const current = acc.get(monthKey) || {
            month: monthKey,
            invoiceCount: 0,
            totalSales: 0,
            totalTax: 0,
            totalDiscount: 0,
          };

          current.invoiceCount += 1;
          current.totalSales += toNumber(invoice.grandTotal, toNumber(invoice.totalAmount, 0));
          current.totalTax += toNumber(invoice.taxAmount, 0);
          current.totalDiscount += toNumber(invoice.discountAmount, 0);

          acc.set(monthKey, current);
          return acc;
        },
        new Map<
          string,
          {
            month: string;
            invoiceCount: number;
            totalSales: number;
            totalTax: number;
            totalDiscount: number;
          }
        >()
      );

      const monthlySales = Array.from(monthlyMap.values()).sort((a, b) => b.month.localeCompare(a.month));

      const summary = monthlySales.reduce(
        (acc, month) => {
          acc.invoiceCount += month.invoiceCount;
          acc.totalSales += month.totalSales;
          acc.totalTax += month.totalTax;
          acc.totalDiscount += month.totalDiscount;
          return acc;
        },
        { invoiceCount: 0, totalSales: 0, totalTax: 0, totalDiscount: 0 }
      );

      return res.status(200).json({
        summary,
        monthlySales,
      });
    } finally {
      await client.close();
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to load monthly invoice sales summary:", error);
    }
    return res.status(500).json({ error: "Failed to load monthly invoice sales summary" });
  }
}

