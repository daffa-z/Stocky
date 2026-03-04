import { NextApiRequest, NextApiResponse } from "next";
import { PrismaClient } from "@prisma/client";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getMongoDb, isReplicaSetTransactionError } from "@/utils/mongo";

const prisma = new PrismaClient();

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["USER", "ADMIN", "DEV"]).optional().default("USER"),
});

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { name, email, password, role } = registerSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({ error: "User already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let username = email.split("@")[0];
    let counter = 1;

    while (await prisma.user.findUnique({ where: { username } })) {
      username = `${email.split("@")[0]}${counter}`;
      counter++;
    }

    const newUser = await prisma.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        username,
        createdAt: new Date(),
        updatedAt: new Date(),
        role,
      },
    });

    return res.status(201).json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      username: newUser.username,
      role: newUser.role,
    });
  } catch (error) {
    if (isReplicaSetTransactionError(error)) {
      try {
        const { name, email, password, role } = registerSchema.parse(req.body);
        const db = await getMongoDb();
        const users = db.collection("User");

        const existingUser = await users.findOne({ email });
        if (existingUser) {
          return res.status(400).json({ error: "User already exists" });
        }

        const baseUsername = email.split("@")[0];
        let username = baseUsername;
        let counter = 1;
        while (await users.findOne({ username })) {
          username = `${baseUsername}${counter}`;
          counter++;
        }

        const now = new Date();
        const hashedPassword = await bcrypt.hash(password, 10);
        const inserted = await users.insertOne({
          name,
          email,
          password: hashedPassword,
          username,
          createdAt: now,
          updatedAt: now,
          role,
        });

        return res.status(201).json({
          id: inserted.insertedId.toString(),
          name,
          email,
          username,
          role,
        });
      } catch (mongoError) {
        console.error("Register fallback error:", mongoError);
        return res.status(500).json({ error: "Failed to register user" });
      }
    }

    if (error instanceof Error) {
      return res.status(500).json({ error: error.message });
    }

    return res.status(500).json({ error: "An unknown error occurred" });
  }
}
