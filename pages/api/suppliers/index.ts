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
        const { name, contactName, phone, email, address } = req.body;

        if (!name?.trim()) {
          return res.status(400).json({ error: "Name is required" });
        }

        const supplier = await prisma.supplier.create({
          data: {
            name: name.trim(),
            contactName: contactName?.trim() || null,
            phone: phone?.trim() || null,
            email: email?.trim() || null,
            address: address?.trim() || null,
            userId,
          },
        });
        res.status(201).json(supplier);
      } catch (error) {
        if (isReplicaSetTransactionError(error)) {
          try {
            const { name, contactName, phone, email, address } = req.body;
            if (!name?.trim()) {
              return res.status(400).json({ error: "Name is required" });
            }
            const payload = {
              name: name.trim(),
              contactName: contactName?.trim() || null,
              phone: phone?.trim() || null,
              email: email?.trim() || null,
              address: address?.trim() || null,
              userId,
            };
            const db = await getMongoDb();
            const result = await db.collection("Supplier").insertOne(payload);
            return res.status(201).json({ id: result.insertedId.toString(), ...payload });
          } catch (mongoError) {
            console.error("Error creating supplier (fallback):", mongoError);
          }
        }
        console.error("Error creating supplier:", error);
        res.status(500).json({ error: "Failed to create supplier" });
      }
      break;
    case "GET":
      try {
        const suppliers = await prisma.supplier.findMany({
          where: {},
          orderBy: { name: "asc" },
        });
        res.status(200).json(suppliers);
      } catch (error) {
        console.error("Error fetching suppliers:", error);
        res.status(500).json({ error: "Failed to fetch suppliers" });
      }
      break;
    case "PUT":
      try {
        const { id, name, contactName, phone, email, address } = req.body;

        if (!id || !name?.trim()) {
          return res.status(400).json({ error: "ID and name are required" });
        }

        const existingSupplier = await prisma.supplier.findFirst({
          where: { id, userId },
        });

        if (!existingSupplier) {
          return res.status(404).json({ error: "Supplier not found" });
        }

        const updatedSupplier = await prisma.supplier.update({
          where: { id },
          data: {
            name: name.trim(),
            contactName: contactName?.trim() || null,
            phone: phone?.trim() || null,
            email: email?.trim() || null,
            address: address?.trim() || null,
          },
        });

        res.status(200).json(updatedSupplier);
      } catch (error) {
        if (isReplicaSetTransactionError(error)) {
          try {
            const { id, name, contactName, phone, email, address } = req.body;
            if (!id || !name?.trim()) {
              return res.status(400).json({ error: "ID and name are required" });
            }
            if (!ObjectId.isValid(id)) {
              return res.status(400).json({ error: "Invalid supplier ID" });
            }
            const db = await getMongoDb();
            const result = await db
              .collection("Supplier")
              .findOneAndUpdate(
                { _id: new ObjectId(id), userId },
                {
                  $set: {
                    name: name.trim(),
                    contactName: contactName?.trim() || null,
                    phone: phone?.trim() || null,
                    email: email?.trim() || null,
                    address: address?.trim() || null,
                  },
                },
                { returnDocument: "after" }
              );
            if (!result.value) {
              return res.status(404).json({ error: "Supplier not found" });
            }
            return res.status(200).json({
              id: result.value._id.toString(),
              name: result.value.name,
              contactName: result.value.contactName,
              phone: result.value.phone,
              email: result.value.email,
              address: result.value.address,
              userId: result.value.userId,
            });
          } catch (mongoError) {
            console.error("Error updating supplier (fallback):", mongoError);
          }
        }
        console.error("Error updating supplier:", error);
        res.status(500).json({ error: "Failed to update supplier" });
      }
      break;
    case "DELETE":
      try {
        const { id } = req.body;

        const supplier = await prisma.supplier.findFirst({
          where: { id, userId },
        });

        if (!supplier) {
          return res.status(404).json({ error: "Supplier not found" });
        }

        await prisma.supplier.delete({
          where: { id },
        });

        res.status(204).end();
      } catch (error) {
        if (isReplicaSetTransactionError(error)) {
          try {
            const { id } = req.body;
            if (!ObjectId.isValid(id)) {
              return res.status(400).json({ error: "Invalid supplier ID" });
            }
            const db = await getMongoDb();
            const result = await db
              .collection("Supplier")
              .deleteOne({ _id: new ObjectId(id), userId });
            if (!result.deletedCount) {
              return res.status(404).json({ error: "Supplier not found" });
            }
            return res.status(204).end();
          } catch (mongoError) {
            console.error("Error deleting supplier (fallback):", mongoError);
          }
        }
        console.error("Error deleting supplier:", error);
        res.status(500).json({ error: "Failed to delete supplier" });
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
