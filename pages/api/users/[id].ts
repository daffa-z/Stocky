import { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import { getSessionServer } from "@/utils/auth";
import { getMongoDb } from "@/utils/mongo";


type UserDocument = {
  name?: string;
  email?: string;
  username?: string;
  role?: string;
  lokasi?: string;
  createdAt?: Date;
  updatedAt?: Date;
};
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


  const role = (session.role || "USER").toUpperCase();
  const isDev = role === "DEV";

  const id = String(req.query.id || "").trim();
  if (!ObjectId.isValid(id)) {
    return res.status(400).json({ error: "Invalid user id" });
  }

  try {
    const db = await getMongoDb();
    const usersCollection = db.collection<UserDocument>("User");

    if (req.method === "PUT") {
      if (!isDev) {
        return res.status(403).json({ error: "Only DEV can edit user data" });
      }
      const { name, username, role, lokasi } = req.body as {
        name?: string;
        username?: string;
        role?: string;
        lokasi?: string;
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

      if (typeof lokasi === "string") {
        const trimmedLokasi = lokasi.trim();
        if (!trimmedLokasi) {
          return res.status(400).json({ error: "Lokasi is required" });
        }
        updateData.lokasi = trimmedLokasi;
      }

      const result = await usersCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: "after" }
      );

      const updatedUser = result.value;
      if (!updatedUser) {
        return res.status(404).json({ error: "User not found" });
      }

      return res.status(200).json({
        id: String(updatedUser._id),
        name: updatedUser.name || "Unknown",
        email: updatedUser.email || "",
        username: updatedUser.username || "",
        role: updatedUser.role || "USER",
        lokasi: (updatedUser as any).lokasi || "PUSAT",
        createdAt: updatedUser.createdAt,
        updatedAt: updatedUser.updatedAt,
      });
    }

    if (req.method === "DELETE") {
      if (!isDev) {
        return res.status(403).json({ error: "Only DEV can edit user data" });
      }
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
