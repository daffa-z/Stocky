import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { getSessionServer } from "@/utils/auth";
import { MongoClient, ObjectId } from "mongodb";

const prisma = new PrismaClient();

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

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
    const mongoUri = process.env.DATABASE_URL;
    if (!mongoUri) {
      return res.status(500).json({ error: "DATABASE_URL is not configured" });
    }

    const client = new MongoClient(mongoUri);
    await client.connect();

    try {
      const dbName = new URL(mongoUri).pathname.replace("/", "") || undefined;
      const db = client.db(dbName);
      const productCollection = db.collection("Product");

      const productObjectIds = uniqueProductIds.map((id) => {
        if (!ObjectId.isValid(id)) {
          return null;
        }
        return new ObjectId(id);
      });

      if (productObjectIds.some((id) => id === null)) {
        return res.status(400).json({ error: "One or more products were not found" });
      }

      const products = await productCollection
        .find({ _id: { $in: productObjectIds as ObjectId[] }, userId })
        .toArray();

      if (products.length !== uniqueProductIds.length) {
        return res.status(400).json({ error: "One or more products were not found" });
      }

      const productById = new Map(products.map((product: any) => [product._id.toString(), product]));

      const supplierIds = [...new Set(products.map((product: any) => product.supplierId).filter(Boolean))];
      const suppliers = await prisma.supplier.findMany({
        where: {
          id: { in: supplierIds },
          userId,
        },
      });
      const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));

      const preparedItems = mergedItems.map((item) => {
        const product: any = productById.get(item.productId);
        if (!product) {
          throw new Error("PRODUCT_NOT_FOUND");
        }

        const available = toNumber(product.quantity, 0);
        if (item.quantity > available) {
          const error = new Error("INSUFFICIENT_STOCK");
          (error as any).meta = { productName: product.name, available };
          throw error;
        }

        const unitPrice = toNumber(product.sellPrice, toNumber(product.price, 0));
        const lineTotal = unitPrice * item.quantity;

        return {
          productId: product._id.toString(),
          name: product.name,
          sku: product.sku,
          supplier: supplierById.get(product.supplierId) || "Unknown",
          price: unitPrice,
          quantity: item.quantity,
          lineTotal,
          remainingQuantity: available - item.quantity,
        };
      });

      await Promise.all(
        preparedItems.map((item) =>
          productCollection.updateOne(
            { _id: new ObjectId(item.productId), userId },
            {
              $set: {
                quantity: item.remainingQuantity,
                status: getStatusByQuantity(item.remainingQuantity),
              },
            }
          )
        )
      );

    const totalAmount = preparedItems.reduce((sum, item) => sum + item.lineTotal, 0);
    const parsedTaxRate = Number.isFinite(Number(taxRate)) ? Math.max(Number(taxRate), 0) : 0;
    const taxAmount = totalAmount * (parsedTaxRate / 100);
    const grandTotal = totalAmount + taxAmount;
    const parsedAmountPaid = Number.isFinite(Number(amountPaid)) ? Math.max(Number(amountPaid), 0) : 0;
    const changeAmount = parsedAmountPaid - grandTotal;

    if (parsedAmountPaid < grandTotal) {
      return res.status(400).json({ error: "Amount paid must be greater than or equal to grand total" });
    }

      const invoiceNumber = createInvoiceNumber();
      const invoiceDocument = {
        invoiceNumber,
        userId,
        customerName: customerName?.trim() || "Walk-in Customer",
        items: preparedItems.map(({ remainingQuantity, ...invoiceItem }) => invoiceItem),
        taxRate: parsedTaxRate,
        taxAmount,
        grandTotal,
        amountPaid: parsedAmountPaid,
        changeAmount,
        paymentMethod: paymentMethod?.trim() || "Cash",
        keterangan: keterangan?.trim() || "",
        totalAmount,
        createdAt: new Date(),
      };

      const result = await db.collection("invoices").insertOne(invoiceDocument);

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
