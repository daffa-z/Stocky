import { NextApiRequest, NextApiResponse } from "next";
import { ObjectId } from "mongodb";
import { getSessionServer } from "@/utils/auth";
import { getMongoDb } from "@/utils/mongo";

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
  const lokasi = typeof (session as any).lokasi === "string" && (session as any).lokasi.trim()
    ? (session as any).lokasi.trim()
    : "PUSAT";
  const isPusat = lokasi.toUpperCase() === "PUSAT";

  const db = await getMongoDb();
  const suppliers = db.collection("Supplier");

  switch (method) {
    case "POST": {
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
          lokasi,
        };

        const result = await suppliers.insertOne(payload);
        return res.status(201).json({ id: result.insertedId.toString(), ...payload });
      } catch (error) {
        console.error("Error creating supplier:", error);
        return res.status(500).json({ error: "Failed to create supplier" });
      }
    }

    case "GET": {
      try {
        const query = isPusat ? {} : { lokasi };
        const records = await suppliers.find(query).sort({ name: 1 }).toArray();

        return res.status(200).json(
          records.map((supplier: any) => ({
            id: supplier._id.toString(),
            name: supplier.name,
            contactName: supplier.contactName || null,
            phone: supplier.phone || null,
            email: supplier.email || null,
            address: supplier.address || null,
            userId: supplier.userId || "",
            lokasi: supplier.lokasi || "PUSAT",
          }))
        );
      } catch (error) {
        console.error("Error fetching suppliers:", error);
        return res.status(500).json({ error: "Failed to fetch suppliers" });
      }
    }

    case "PUT": {
      try {
        const { id, name, contactName, phone, email, address } = req.body;

        if (!id || !name?.trim()) {
          return res.status(400).json({ error: "ID and name are required" });
        }

        if (!ObjectId.isValid(id)) {
          return res.status(400).json({ error: "Invalid supplier ID" });
        }

        const filter = isPusat ? { _id: new ObjectId(id) } : { _id: new ObjectId(id), lokasi };

        const result = await suppliers.findOneAndUpdate(
          filter,
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
          contactName: result.value.contactName || null,
          phone: result.value.phone || null,
          email: result.value.email || null,
          address: result.value.address || null,
          userId: result.value.userId || "",
          lokasi: result.value.lokasi || "PUSAT",
        });
      } catch (error) {
        console.error("Error updating supplier:", error);
        return res.status(500).json({ error: "Failed to update supplier" });
      }
    }

    case "DELETE": {
      try {
        const { id } = req.body;

        if (!id || !ObjectId.isValid(id)) {
          return res.status(400).json({ error: "Invalid supplier ID" });
        }

        const filter = isPusat ? { _id: new ObjectId(id) } : { _id: new ObjectId(id), lokasi };
        const result = await suppliers.deleteOne(filter);

        if (!result.deletedCount) {
          return res.status(404).json({ error: "Supplier not found" });
        }

        return res.status(204).end();
      } catch (error) {
        console.error("Error deleting supplier:", error);
        return res.status(500).json({ error: "Failed to delete supplier" });
      }
    }

    default:
      res.setHeader("Allow", ["POST", "GET", "PUT", "DELETE"]);
      return res.status(405).end(`Method ${method} Not Allowed`);
  }
}

export const config = {
  api: {
    externalResolver: true,
  },
};
