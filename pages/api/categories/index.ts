import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { ObjectId } from "mongodb";
import { getSessionServer } from "@/utils/auth";
import { getMongoDb, isReplicaSetTransactionError } from "@/utils/mongo";

const prisma = new PrismaClient();

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
        const { name } = req.body;
        const category = await prisma.category.create({
          data: {
            name,
            userId,
          },
        });
        res.status(201).json(category);
      } catch (error) {
        if (isReplicaSetTransactionError(error)) {
          try {
            const { name } = req.body;
            const db = await getMongoDb();
            const result = await db.collection("Category").insertOne({ name, userId });
            return res.status(201).json({ id: result.insertedId.toString(), name, userId });
          } catch (mongoError) {
            console.error("Error creating category (fallback):", mongoError);
          }
        }
        console.error("Error creating category:", error);
        res.status(500).json({ error: "Failed to create category" });
      }
      break;
    case "GET":
      try {
        const categories = await prisma.category.findMany({
          where: {},
        });
        res.status(200).json(categories);
      } catch (error) {
        console.error("Error fetching categories:", error);
        res.status(500).json({ error: "Failed to fetch categories" });
      }
      break;
    case "PUT":
      try {
        const { id, name } = req.body;

        if (!id || !name) {
          return res.status(400).json({ error: "ID and name are required" });
        }

        const updatedCategory = await prisma.category.update({
          where: { id },
          data: { name },
        });

        res.status(200).json(updatedCategory);
      } catch (error) {
        if (isReplicaSetTransactionError(error)) {
          try {
            const { id, name } = req.body;
            if (!ObjectId.isValid(id)) {
              return res.status(400).json({ error: "Invalid category ID" });
            }
            const db = await getMongoDb();
            const result = await db
              .collection("Category")
              .findOneAndUpdate(
                { _id: new ObjectId(id), userId },
                { $set: { name } },
                { returnDocument: "after" }
              );
            if (!result.value) {
              return res.status(404).json({ error: "Category not found" });
            }
            return res.status(200).json({
              id: result.value._id.toString(),
              name: result.value.name,
              userId: result.value.userId,
            });
          } catch (mongoError) {
            console.error("Error updating category (fallback):", mongoError);
          }
        }
        console.error("Error updating category:", error);
        res.status(500).json({ error: "Failed to update category" });
      }
      break;
    case "DELETE":
      try {
        const { id } = req.body;

        const category = await prisma.category.findUnique({
          where: { id },
        });

        if (!category) {
          return res.status(404).json({ error: "Category not found" });
        }

        await prisma.category.delete({
          where: { id },
        });

        res.status(204).end();
      } catch (error) {
        if (isReplicaSetTransactionError(error)) {
          try {
            const { id } = req.body;
            if (!ObjectId.isValid(id)) {
              return res.status(400).json({ error: "Invalid category ID" });
            }
            const db = await getMongoDb();
            const result = await db
              .collection("Category")
              .deleteOne({ _id: new ObjectId(id), userId });
            if (!result.deletedCount) {
              return res.status(404).json({ error: "Category not found" });
            }
            return res.status(204).end();
          } catch (mongoError) {
            console.error("Error deleting category (fallback):", mongoError);
          }
        }
        console.error("Error deleting category:", error);
        res.status(500).json({ error: "Failed to delete category" });
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
