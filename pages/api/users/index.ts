import { NextApiRequest, NextApiResponse } from "next";
import { getSessionServer } from "@/utils/auth";
import { getMongoDb } from "@/utils/mongo";

const toSafeDate = (value: unknown) => {
  const date = new Date(typeof value === "string" || value instanceof Date ? value : Date.now());
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (req.method !== "GET") {
    res.setHeader("Allow", ["GET"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const page = Math.max(Number(req.query.page) || 1, 1);
  const limit = Math.min(Math.max(Number(req.query.limit) || 10, 1), 100);
  const search = String(req.query.search || "").trim();

  try {
    const db = await getMongoDb();
    const usersCollection = db.collection("User");

    const query: Record<string, unknown> = {};
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
        { username: { $regex: search, $options: "i" } },
        { role: { $regex: search, $options: "i" } },
        { lokasi: { $regex: search, $options: "i" } },
      ];
    }

    const totalCount = await usersCollection.countDocuments(query);
    const totalPages = Math.max(Math.ceil(totalCount / limit), 1);
    const safePage = Math.min(page, totalPages);
    const skip = (safePage - 1) * limit;

    const records = await usersCollection
      .find(query)
      .sort({ createdAt: -1, _id: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    const users = records.map((user: any) => ({
      id: String(user._id),
      name: typeof user.name === "string" ? user.name : "Unknown",
      email: typeof user.email === "string" ? user.email : "",
      username: typeof user.username === "string" ? user.username : "",
      role: typeof user.role === "string" ? user.role : "ADMIN",
      lokasi: typeof user.lokasi === "string" && user.lokasi.trim() ? user.lokasi : "PUSAT",
      createdAt: toSafeDate(user.createdAt),
      updatedAt: toSafeDate(user.updatedAt || user.createdAt),
    }));

    return res.status(200).json({
      users,
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
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to load users:", error);
    }
    return res.status(500).json({ error: "Failed to load users" });
  }
}
