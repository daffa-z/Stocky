import { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import { getSessionServer } from "@/utils/auth";
import { getMongoDb } from "@/utils/mongo";

const normalizeRole = (role: unknown) => {
  const value = typeof role === "string" ? role.trim().toUpperCase() : "";
  if (value === "ADMIN" || value === "USER" || value === "DEV") {
    return value;
  }
  return "USER";
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getSessionServer(req, res);
  if (!session) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const id = String(req.query.id || "").trim();
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const db = await getMongoDb();
    const usersCollection = db.collection("User");

    if (req.method === "PUT") {
      const { name, username, role } = req.body as {
        name?: string;
        username?: string;
        role?: string;
      };

      const updateData: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (typeof name === "string") {
        const trimmedName = name.trim();
        if (!trimmedName) {
          return res.status(400).json({ error: "Name is required" });
        }
        updateData.name = trimmedName;
      }

      if (typeof username === "string") {
        const trimmedUsername = username.trim();
        if (trimmedUsername) {
          const duplicate = await usersCollection.findOne({ username: trimmedUsername, _id: { $ne: new ObjectId(id) } });
          if (duplicate) {
            return res.status(400).json({ error: "Username is already used" });
          }
          updateData.username = trimmedUsername;
        } else {
          updateData.username = "";
        }
      }

      if (role !== undefined) {
        updateData.role = normalizeRole(role);
      }

      const result = await usersCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: "after" }
      );

      if (!result) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.status(200).json({
        id: String(result._id),
        name: result.name || "Unknown",
        email: result.email || "",
        username: result.username || "",
        role: result.role || "USER",
        createdAt: result.createdAt,
        updatedAt: result.updatedAt,
      });
    }

    if (req.method === "DELETE") {
      if (session.id === id) {
        return res.status(400).json({ error: "You cannot delete your own account" });
      }

      const deleted = await usersCollection.findOneAndDelete({ _id: new ObjectId(id) });
      if (!deleted) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.status(200).json({ success: true, id });
    }

    res.setHeader("Allow", ["PUT", "DELETE"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("Failed to modify user:", error);
    }
    return res.status(500).json({ error: "Failed to modify user" });
  }
}
