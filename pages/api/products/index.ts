import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { getSessionServer } from "@/utils/auth";
import { MongoClient, ObjectId } from "mongodb";

const prisma = new PrismaClient();
const mongoClient = new MongoClient(process.env.DATABASE_URL || "");

const getProductsCollection = async () => {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  await mongoClient.connect();
  const db = mongoClient.db();
  return db.collection("Product");
};

const toNumber = (value: unknown, fallback = 0) => {
  if (typeof value === "number") return value;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toIsoDate = (value: unknown) => {
  const date = value ? new Date(value as string | number | Date) : new Date();
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

const findCategoryNameById = async (categoryId?: string) => {
  if (!categoryId) return "Tidak Diketahui";
  try {
    const category = await prisma.category.findUnique({ where: { id: categoryId } });
    return category?.name || "Tidak Diketahui";
  } catch {
    return "Tidak Diketahui";
  }
};

const findSupplierNameById = async (supplierId?: string) => {
  if (!supplierId) return "Tidak Diketahui";
  try {
    const supplier = await prisma.supplier.findUnique({ where: { id: supplierId } });
    return supplier?.name || "Tidak Diketahui";
  } catch {
    return "Tidak Diketahui";
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { method } = req;
  const userId = session.id;

  switch (method) {
    case "POST":
      try {
        const {
          name,
          sku,
          quantity,
          status,
          categoryId,
          supplierId,
          unit,
          buyPrice,
          sellPrice,
          price,
        } = req.body;

        const collection = await getProductsCollection();
        const existingProduct = await collection.findOne({ sku });

        if (existingProduct) {
          return res.status(400).json({ error: "SKU must be unique" });
        }

        const normalizedSellPrice = toNumber(sellPrice ?? price, 0);
        const normalizedBuyPrice = toNumber(buyPrice ?? normalizedSellPrice, 0);
        const createdAt = new Date();

        const productDoc = {
          name,
          sku,
          quantity: toNumber(quantity, 0),
          status,
          userId,
          categoryId,
          supplierId,
          createdAt,
          unit: unit || "pcs",
          buyPrice: normalizedBuyPrice,
          sellPrice: normalizedSellPrice,
          price: normalizedSellPrice,
        };

        const inserted = await collection.insertOne(productDoc);

        const categoryName = await findCategoryNameById(categoryId);
        const supplierName = await findSupplierNameById(supplierId);

        res.status(201).json({
          id: inserted.insertedId.toString(),
          ...productDoc,
          createdAt: createdAt.toISOString(),
          category: categoryName,
          supplier: supplierName,
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to create product" });
      }
      break;

    case "GET":
      try {
        const collection = await getProductsCollection();
        const products = await collection.find({ userId }).toArray();

        const transformedProducts = await Promise.all(
          products.map(async (product: any) => {
            const categoryName = await findCategoryNameById(product.categoryId);
            const supplierName = await findSupplierNameById(product.supplierId);

            return {
              id: product._id.toString(),
              name: product.name,
              sku: product.sku,
              quantity: toNumber(product.quantity, 0),
              status: product.status,
              userId: product.userId,
              categoryId: product.categoryId,
              supplierId: product.supplierId,
              createdAt: toIsoDate(product.createdAt),
              unit: product.unit || "pcs",
              buyPrice: toNumber(product.buyPrice, toNumber(product.price, 0)),
              sellPrice: toNumber(product.sellPrice, toNumber(product.price, 0)),
              price: toNumber(product.sellPrice, toNumber(product.price, 0)),
              category: categoryName,
              supplier: supplierName,
            };
          })
        );

        const safeProducts = transformedProducts.filter((product): product is NonNullable<typeof product> => Boolean(product));

        res.status(200).json(safeProducts);

      } catch (error) {
        res.status(500).json({ error: "Failed to fetch products" });
      }
      break;

    case "PUT":
      try {
        const {
          id,
          name,
          sku,
          quantity,
          status,
          categoryId,
          supplierId,
          unit,
          buyPrice,
          sellPrice,
          price,
        } = req.body;

        const collection = await getProductsCollection();
        const normalizedSellPrice = toNumber(sellPrice ?? price, 0);
        const normalizedBuyPrice = toNumber(buyPrice ?? normalizedSellPrice, 0);

        await collection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              name,
              sku,
              quantity: toNumber(quantity, 0),
              status,
              categoryId,
              supplierId,
              unit: unit || "pcs",
              buyPrice: normalizedBuyPrice,
              sellPrice: normalizedSellPrice,
              price: normalizedSellPrice,
            },
          }
        );

        const updatedProduct = await collection.findOne({ _id: new ObjectId(id) });
        const categoryName = await findCategoryNameById(categoryId);
        const supplierName = await findSupplierNameById(supplierId);

        if (!updatedProduct) {
          return res.status(404).json({ error: "Product not found" });
        }

        res.status(200).json({
          id: updatedProduct._id.toString(),
          name: updatedProduct.name,
          sku: updatedProduct.sku,
          quantity: toNumber(updatedProduct.quantity, 0),
          status: updatedProduct.status,
          userId: updatedProduct.userId,
          categoryId: updatedProduct.categoryId,
          supplierId: updatedProduct.supplierId,
          createdAt: toIsoDate(updatedProduct.createdAt),
          unit: updatedProduct.unit || "pcs",
          buyPrice: toNumber(updatedProduct.buyPrice, toNumber(updatedProduct.price, 0)),
          sellPrice: toNumber(updatedProduct.sellPrice, toNumber(updatedProduct.price, 0)),
          price: toNumber(updatedProduct.sellPrice, toNumber(updatedProduct.price, 0)),
          category: categoryName,
          supplier: supplierName,
        });
      } catch (error) {
        res.status(500).json({ error: "Failed to update product" });
      }
      break;

    case "DELETE":
      try {
        const { id } = req.body;
        const collection = await getProductsCollection();
        await collection.deleteOne({ _id: new ObjectId(id) });

        res.status(204).end();
      } catch (error) {
        res.status(500).json({ error: "Failed to delete product" });
      }
      break;

    default:
      res.setHeader("Allow", ["POST", "GET", "PUT", "DELETE"]);
      res.status(405).end(`Method ${method} Not Allowed`);
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
