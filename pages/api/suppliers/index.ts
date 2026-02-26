import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { getSessionServer } from "@/utils/auth";

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
        console.error("Error creating supplier:", error);
        res.status(500).json({ error: "Failed to create supplier" });
      }
      break;
    case "GET":
      try {
        const suppliers = await prisma.supplier.findMany({
          where: { userId },
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
