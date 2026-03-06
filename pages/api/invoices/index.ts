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

const normalizeDiscountType = (value: unknown): "percentage" | "fixed" => {
  if (value === "percentage") return "percentage";
  return "fixed";
};

const getStatusByQuantity = (quantity: number) => {
  if (quantity > 20) return "Available";
  if (quantity > 0) return "Stock Low";
  return "Stock Out";
};

type NormalizedInvoiceItem = {
  productId: string;
  name: string;
  sku: string;
  supplier: string;
  price: number;
  quantity: number;
  lineTotal: number;
};

type NormalizedInvoice = {
  id: string;
  invoiceNumber: string;
  customerName: string;
  totalAmount: number;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountAmount: number;
  promoCode: string;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  amountPaid: number;
  changeAmount: number;
  paymentMethod: string;
  bankName: string;
  createdByUserId: string;
  createdByName: string;
  createdByEmail: string;
  keterangan: string;
  signatureName: string;
  createdAt: string;
  items: NormalizedInvoiceItem[];
};

const createInvoiceNumber = () => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
  const randomPart = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `INV-${datePart}-${randomPart}`;
};


const normalizeInvoice = (invoice: any): NormalizedInvoice => ({
  id: String(invoice._id),
  invoiceNumber: invoice.invoiceNumber,
  customerName: invoice.customerName,
  totalAmount: toNumber(invoice.totalAmount),
  discountType: normalizeDiscountType(invoice.discountType),
  discountValue: toNumber(invoice.discountValue),
  discountAmount: toNumber(invoice.discountAmount),
  promoCode: typeof invoice.promoCode === "string" ? invoice.promoCode : "",
  taxRate: toNumber(invoice.taxRate),
  taxAmount: toNumber(invoice.taxAmount),
  grandTotal: toNumber(invoice.grandTotal),
  amountPaid: toNumber(invoice.amountPaid),
  changeAmount: toNumber(invoice.changeAmount),
  paymentMethod: invoice.paymentMethod,
  bankName: typeof invoice.bankName === "string" ? invoice.bankName : "",
  createdByUserId: invoice.createdByUserId || invoice.userId || "",
  createdByName: invoice.createdByName || "admin",
  createdByEmail: invoice.createdByEmail || "",
  keterangan: invoice.keterangan,
  signatureName: typeof invoice.signatureName === "string" ? invoice.signatureName : "Koperasi",
  createdAt: new Date(invoice.createdAt).toISOString(),
  items: Array.isArray(invoice.items)
    ? invoice.items.map((item: any): NormalizedInvoiceItem => ({
        productId: item.productId,
        name: item.name,
        sku: item.sku,
        supplier: item.supplier,
        price: toNumber(item.price),
        quantity: toNumber(item.quantity),
        lineTotal: toNumber(item.lineTotal),
      }))
    : [],
});

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
    const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
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
        const invoiceCollection = db.collection("invoices");

        const analyticsQuery: any = isPusat ? {} : { lokasi };
        const recentInvoiceQuery: any = isPusat ? {} : { lokasi };

        if (search) {
          recentInvoiceQuery.$or = [
            { invoiceNumber: { $regex: search, $options: "i" } },
            { customerName: { $regex: search, $options: "i" } },
            { promoCode: { $regex: search, $options: "i" } },
            { paymentMethod: { $regex: search, $options: "i" } },
            { keterangan: { $regex: search, $options: "i" } },
          ];
        }

        const totalCount = await invoiceCollection.countDocuments(recentInvoiceQuery);
        const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
        const safePage = Math.min(page, totalPages);
        const skip = (safePage - 1) * limit;

        const invoices = await invoiceCollection.find(recentInvoiceQuery).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray();
        const allInvoices = await invoiceCollection.find(analyticsQuery).toArray();

        const normalizedInvoices = invoices.map(normalizeInvoice);
        const normalizedAnalyticsInvoices = allInvoices.map(normalizeInvoice);

        const totals = normalizedAnalyticsInvoices.reduce(
          (acc, invoice) => {
            acc.revenue += invoice.grandTotal;
            acc.taxCollected += invoice.taxAmount;
            acc.invoiceCount += 1;
            acc.itemsSold += invoice.items.reduce((sum: number, item: { quantity: number }) => sum + item.quantity, 0);
            acc.totalDiscount += invoice.discountAmount;
            return acc;
          },
          { revenue: 0, taxCollected: 0, invoiceCount: 0, itemsSold: 0, totalDiscount: 0 }
        );

        const supplierMap = new Map<string, { supplier: string; quantity: number; revenue: number }>();
        const productMap = new Map<string, { productId: string; name: string; sku: string; quantity: number; revenue: number }>();

        normalizedAnalyticsInvoices.forEach((invoice) => {
          invoice.items.forEach((item) => {
            const supplierKey = item.supplier || "Unknown";
            const supplierEntry = supplierMap.get(supplierKey) || { supplier: supplierKey, quantity: 0, revenue: 0 };
            supplierEntry.quantity += item.quantity;
            supplierEntry.revenue += item.lineTotal;
            supplierMap.set(supplierKey, supplierEntry);

            const productKey = item.productId || item.sku || item.name;
            const productEntry = productMap.get(productKey) || {
              productId: item.productId,
              name: item.name,
              sku: item.sku,
              quantity: 0,
              revenue: 0,
            };
            productEntry.quantity += item.quantity;
            productEntry.revenue += item.lineTotal;
            productMap.set(productKey, productEntry);
          });
        });

        const supplierBreakdown = Array.from(supplierMap.values()).sort((a, b) => b.revenue - a.revenue);
        const topProducts = Array.from(productMap.values())
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 10);

        return res.status(200).json({
          invoices: normalizedInvoices,
          summary: {
            ...totals,
            averageInvoiceValue: totals.invoiceCount > 0 ? totals.revenue / totals.invoiceCount : 0,
          },
          pagination: {
            page: safePage,
            limit,
            totalCount,
            totalPages,
            hasPrev: safePage > 1,
            hasNext: safePage < totalPages,
            search,
          },
          supplierBreakdown,
          topProducts,
        });
      } finally {
        await client.close();
      }
    } catch (error) {
      if (process.env.NODE_ENV === "development") {
        console.error("Failed to load invoices:", error);
      }
      return res.status(500).json({ error: "Failed to load invoices" });
    }
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", ["GET", "POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const { customerName, items, taxRate, amountPaid, paymentMethod, bankName, keterangan, signatureName } = req.body as {
    customerName?: string;
    items?: Array<{ productId: string; quantity: number }>;
    taxRate?: number;
    amountPaid?: number;
    paymentMethod?: string;
    bankName?: string;
    keterangan?: string;
    signatureName?: string;
    discountType?: "percentage" | "fixed";
    discountValue?: number;
    promoCode?: string;
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

      const products = await productCollection.find(isPusat
        ? { _id: { $in: productObjectIds as ObjectId[] } }
        : { _id: { $in: productObjectIds as ObjectId[] }, lokasi }).toArray();

      if (products.length !== uniqueProductIds.length) {
        return res.status(400).json({ error: "One or more products were not found" });
      }

      const productById = new Map(products.map((product: any) => [product._id.toString(), product]));

      const supplierIds = [...new Set(products.map((product: any) => product.supplierId).filter(Boolean))];
      const suppliers = await prisma.supplier.findMany({
        where: {
          id: { in: supplierIds },
        },
      });
      const supplierById = new Map(suppliers.map((supplier) => [supplier.id, supplier.name]));

      const categoryIds = [...new Set(products.map((product: any) => product.categoryId).filter(Boolean))];
      const categories = await prisma.category.findMany({
        where: {
          id: { in: categoryIds },
        },
      });
      const categoryById = new Map(categories.map((category) => [category.id, category.name]));

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
          category: categoryById.get(product.categoryId) || "Unknown",
          unit: product.unit || "pcs",
          price: unitPrice,
          quantity: item.quantity,
          stockBefore: available,
          lineTotal,
          remainingQuantity: available - item.quantity,
        };
      });

      await Promise.all(
        preparedItems.map((item) =>
          productCollection.updateOne(
            isPusat ? { _id: new ObjectId(item.productId) } : { _id: new ObjectId(item.productId), lokasi },
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
      const parsedDiscountType = normalizeDiscountType(req.body.discountType);
      const parsedDiscountValue = Number.isFinite(Number(req.body.discountValue)) ? Math.max(Number(req.body.discountValue), 0) : 0;
      const discountAmount =
        parsedDiscountType === "percentage"
          ? Math.min(totalAmount * (parsedDiscountValue / 100), totalAmount)
          : Math.min(parsedDiscountValue, totalAmount);
      const taxableAmount = Math.max(totalAmount - discountAmount, 0);
      const parsedTaxRate = Number.isFinite(Number(taxRate)) ? Math.max(Number(taxRate), 0) : 0;
      const taxAmount = taxableAmount * (parsedTaxRate / 100);
      const grandTotal = taxableAmount + taxAmount;
      const parsedAmountPaid = Number.isFinite(Number(amountPaid)) ? Math.max(Number(amountPaid), 0) : 0;
      const changeAmount = parsedAmountPaid - grandTotal;

      if (parsedAmountPaid < grandTotal) {
        return res.status(400).json({ error: "Amount paid must be greater than or equal to grand total" });
      }

      const invoiceNumber = createInvoiceNumber();
      const invoiceDocument = {
        invoiceNumber,
        userId,
        lokasi,
        createdByUserId: session.id,
        createdByName: session.name || "admin",
        createdByEmail: session.email || "",
        customerName: customerName?.trim() || "Walk-in Customer",
        items: preparedItems.map(({ remainingQuantity, stockBefore, category, unit, ...invoiceItem }) => invoiceItem),
        discountType: parsedDiscountType,
        discountValue: parsedDiscountValue,
        discountAmount,
        promoCode: typeof req.body.promoCode === "string" ? req.body.promoCode.trim().toUpperCase() : "",
        taxRate: parsedTaxRate,
        taxAmount,
        grandTotal,
        amountPaid: parsedAmountPaid,
        changeAmount,
        paymentMethod: paymentMethod?.trim() || "Cash",
        bankName: bankName?.trim() || "",
        keterangan: keterangan?.trim() || "",
        signatureName: signatureName?.trim() || "Koperasi",
        totalAmount,
        createdAt: new Date(),
      };

      const result = await db.collection("invoices").insertOne(invoiceDocument);

      await db.collection("stock_movements").insertMany(
        preparedItems.map((item) => ({
          userId,
          lokasi,
          createdByUserId: session.id,
          createdByName: session.name || "admin",
          createdByEmail: session.email || "",
          productId: item.productId,
          productName: item.name,
          category: item.category,
          supplier: item.supplier,
          unit: item.unit,
          movementType: "OUT",
          quantity: item.quantity,
          stockBefore: item.stockBefore,
          stockAfter: item.remainingQuantity,
          invoiceReference: invoiceNumber,
          notes: `Invoice ${invoiceNumber}`,
          createdAt: new Date(),
        }))
      );

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
