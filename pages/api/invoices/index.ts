import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { getSessionServer } from "@/utils/auth";
import { MongoClient } from "mongodb";

const prisma = new PrismaClient();

const getStatusByQuantity = (quantity: number) => {
  if (quantity > 20) return "Available";
  if (quantity > 0) return "Stock Low";
  return "Stock Out";
};

const createInvoiceNumber = () => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${datePart}-${randomPart}`;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const userId = session.id;
  const { customerName, items, taxRate, amountPaid, paymentMethod, keterangan } = req.body as {
    customerName?: string;
    items?: Array<{ productId: string; quantity: number }>;
    taxRate?: number;
    amountPaid?: number;
    paymentMethod?: string;
    keterangan?: string;
  };

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "Invoice items are required" });
  }

  const normalizedItems = items.map((item) => ({
    productId: item.productId,
    quantity: Number(item.quantity),
  }));

  if (normalizedItems.some((item) => !item.productId || Number.isNaN(item.quantity) || item.quantity <= 0)) {
    return res.status(400).json({ error: "Each invoice item needs a valid product and quantity" });
  }

  const mergedItems = Array.from(
    normalizedItems.reduce((acc, item) => {
      acc.set(item.productId, (acc.get(item.productId) || 0) + item.quantity);
      return acc;
    }, new Map<string, number>())
  ).map(([productId, quantity]) => ({ productId, quantity }));

  const uniqueProductIds = mergedItems.map((item) => item.productId);

  try {
    const products = await prisma.product.findMany({
      where: {
        id: { in: uniqueProductIds },
        userId,
      },
    });

    if (products.length !== uniqueProductIds.length) {
      return res.status(400).json({ error: "One or more products were not found" });
    }

    const productById = new Map(products.map((product) => [product.id, product]));

    const supplierIds = [...new Set(products.map((product) => product.supplierId))];
    const suppliers = await prisma.supplier.findMany({
      where: {
        id: { in: supplierIds },
        userId,
      },
    });
    const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));

    const preparedItems = mergedItems.map((item) => {
      const product = productById.get(item.productId);
      if (!product) {
        throw new Error("PRODUCT_NOT_FOUND");
      }

      const available = Number(product.quantity);
      if (item.quantity > available) {
        const error = new Error("INSUFFICIENT_STOCK");
        (error as any).meta = { productName: product.name, available };
        throw error;
      }

      const lineTotal = product.price * item.quantity;

      return {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        supplier: supplierById.get(product.supplierId) || "Unknown",
        price: product.price,
        quantity: item.quantity,
        lineTotal,
        remainingQuantity: available - item.quantity,
      };
    });

    await prisma.$transaction(
      preparedItems.map((item) =>
        prisma.product.update({
          where: { id: item.productId },
          data: {
            quantity: BigInt(item.remainingQuantity) as any,
            status: getStatusByQuantity(item.remainingQuantity),
          },
        })
      )
    );

    const totalAmount = preparedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const parsedTaxRate = Number.isFinite(Number(taxRate)) ? Math.max(Number(taxRate), 0) : 0;
    const taxAmount = totalAmount * (parsedTaxRate / 100);
    const grandTotal = totalAmount + taxAmount;
    const parsedAmountPaid = Number.isFinite(Number(amountPaid)) ? Math.max(Number(amountPaid), 0) : 0;

    if (parsedAmountPaid < grandTotal) {
      return res.status(400).json({ error: "Amount paid must be greater than or equal to grand total" });
    }

    const changeAmount = parsedAmountPaid - grandTotal;
    const invoiceNumber = createInvoiceNumber();

    const mongoUri = process.env.DATABASE_URL;
    if (!mongoUri) {
      return res.status(500).json({ error: "DATABASE_URL is not configured" });
    }

    const client = new MongoClient(mongoUri);
    await client.connect();

    try {
      const dbName = new URL(mongoUri).pathname.replace("/", "") || undefined;

      const invoiceDocument = {
        invoiceNumber,
        userId,
        customerName: customerName?.trim() || "Walk-in Customer",
        items: preparedItems.map(({ remainingQuantity, ...invoiceItem }) => invoiceItem),
        totalAmount,
        taxRate: parsedTaxRate,
        taxAmount,
        grandTotal,
        amountPaid: parsedAmountPaid,
        changeAmount,
        paymentMethod: paymentMethod?.trim() || "Cash",
        keterangan: keterangan?.trim() || "",
        createdAt: new Date(),
      };

      const result = await client.db(dbName).collection("invoices").insertOne(invoiceDocument);

      return res.status(201).json({
        id: String(result.insertedId),
        ...invoiceDocument,
        createdAt: invoiceDocument.createdAt.toISOString(),
      });
    } finally {
      await client.close();
    }
  } catch (error: any) {
    if (error?.message === "INSUFFICIENT_STOCK") {
      const meta = error.meta || {};
      return res.status(400).json({
        error: `Insufficient stock for ${meta.productName || "product"}. Available: ${meta.available ?? 0}`,
      });
    }

    if (process.env.NODE_ENV === "development") {
      console.error("Failed to create invoice:", error);
    }

    return res.status(500).json({ error: "Failed to create invoice" });
  }
}
