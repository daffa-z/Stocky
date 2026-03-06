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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const userId = session.id;
  const lokasi = typeof (session as any).lokasi === "string" && (session as any).lokasi.trim()
    ? (session as any).lokasi.trim()
     : "PUSAT";
  const isPusat = lokasi.toUpperCase() === "PUSAT";

  if (req.method === "GET") {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 100);
    const page = Math.max(Number(req.query.page) || 1, 1);
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";

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
        const collection = db.collection("stock_movements");

        const query: any = isPusat ? {} : { lokasi };
        if (search) {
          query.$or = [
            { productName: { $regex: search, $options: "i" } },
            { invoiceReference: { $regex: search, $options: "i" } },
            { supplier: { $regex: search, $options: "i" } },
            { category: { $regex: search, $options: "i" } },
            { movementType: { $regex: search, $options: "i" } },
          ];
        }

        const totalCount = await collection.countDocuments(query);
        const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
        const safePage = Math.min(page, totalPages);
        const skip = (safePage - 1) * limit;

        const records = await collection.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();

        const movements = records.map((record: any) => ({
          id: String(record._id),
          date: new Date(record.createdAt).toISOString(),
          movementType: record.movementType || "OUT",
          quantity: toNumber(record.quantity),
          stockBefore: toNumber(record.stockBefore),
          stockAfter: toNumber(record.stockAfter),
          invoiceReference: record.invoiceReference || "",
          productName: record.productName || "Unknown",
          category: record.category || "Unknown",
          supplier: record.supplier || "Unknown",
          unit: record.unit || "pcs",
          notes: record.notes || "",
          createdByUserId: record.createdByUserId || record.userId || "",
          createdByName: record.createdByName || "admin",
          createdByEmail: record.createdByEmail || "",
        }));

        return res.status(200).json({
          movements,
          pagination: {
            page: safePage,
            limit,
            totalCount,
            totalPages,
            hasPrev: safePage > 1,
            hasNext: safePage < totalPages,
            search,
          },
        });
      } finally {
        await client.close();
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to load stock movements:", error);
      }
      return res.status(500).json({ error: "Failed to load stock movements" });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { productId, movementType, quantity, invoiceReference, notes } = req.body as {
    productId?: string;
    movementType?: "IN" | "OUT";
    quantity?: number;
    invoiceReference?: string;
    notes?: string;
  };

  if (!productId || !ObjectId.isValid(productId)) {
    return res.status(400).json({ error: "Valid productId is required" });
  }

  const parsedQty = Math.max(toNumber(quantity), 0);
  if (parsedQty <= 0) {
    return res.status(400).json({ error: "Quantity must be greater than 0" });
  }

  const safeMovementType: "IN" | "OUT" = movementType === "IN" ? "IN" : "OUT";

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
      const movementCollection = db.collection("stock_movements");

      const product = await productCollection.findOne(isPusat ? { _id: new ObjectId(productId) } : { _id: new ObjectId(productId), lokasi });
      if (!product) {
        return res.status(404).json({ error: "Product not found" });
      }

      const stockBefore = toNumber(product.quantity, 0);
      const stockAfter = safeMovementType === "IN" ? stockBefore + parsedQty : stockBefore - parsedQty;

      if (stockAfter < 0) {
        return res.status(400).json({ error: "Stock is not enough for OUT movement" });
      }

      const [category, supplier] = await Promise.all([
        product.categoryId ? prisma.category.findUnique({ where: { id: product.categoryId } }) : null,
        product.supplierId ? prisma.supplier.findUnique({ where: { id: product.supplierId } }) : null,
      ]);

      await productCollection.updateOne(
        isPusat ? { _id: new ObjectId(productId) } : { _id: new ObjectId(productId), lokasi },
        {
          $set: {
            quantity: stockAfter,
            status: getStatusByQuantity(stockAfter),
          },
        }
      );

      const movementDoc = {
        userId,
        lokasi,
        createdByUserId: session.id,
        createdByName: session.name || "admin",
        createdByEmail: session.email || "",
        productId,
        productName: product.name || "Unknown",
        category: category?.name || "Unknown",
        supplier: supplier?.name || "Unknown",
        unit: product.unit || "pcs",
        movementType: safeMovementType,
        quantity: parsedQty,
        stockBefore,
        stockAfter,
        invoiceReference: invoiceReference?.trim() || "",
        notes: notes?.trim() || "",
        createdAt: new Date(),
      };

      const inserted = await movementCollection.insertOne(movementDoc);
      return res.status(201).json({ id: String(inserted.insertedId), ...movementDoc, date: movementDoc.createdAt.toISOString() });
    } finally {
      await client.close();
    }
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to create stock movement:", error);
    }
    return res.status(500).json({ error: "Failed to create stock movement" });
  }
}
