"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import axiosInstance from "@/utils/axiosInstance";
import Link from "next/link";
import { useToast } from "@/hooks/use-toast";

type RoleType = "USER" | "ADMIN" | "DEV";

export default function Register() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<RoleType>("USER");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await axiosInstance.post("/auth/register", {
        name,
        email,
        password,
        role,
      });

      if (response.status === 201) {
        toast({
          title: "Account Created Successfully!",
          description: "Your account has been created. Redirecting to login page...",
        });

        setName("");
        setEmail("");
        setPassword("");
        setRole("USER");

        setTimeout(() => {
          router.push("/login");
        }, 1500);
      } else {
        throw new Error("Registration failed");
      }
    } catch (error) {
      toast({
        title: "Registration Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex justify-center items-center h-screen">
      <form onSubmit={handleSubmit} className="w-full max-w-md p-8 space-y-4">
        <h2 className="text-2xl font-bold">Register</h2>
        <Input type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" required />
        <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
        <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />

        <select
          value={role}
          onChange={(e) => setRole((e.target.value === "ADMIN" ? "ADMIN" : e.target.value === "DEV" ? "DEV" : "USER") as RoleType)}
          className="w-full h-10 rounded-md border bg-background px-3"
        >
          <option value="USER">USER</option>
          <option value="ADMIN">ADMIN</option>
          <option value="DEV">DEV</option>
        </select>

        <Button type="submit" className="w-full" disabled={isLoading}>
          {isLoading ? "Creating Account..." : "Register"}
        </Button>

        <div className="text-center">
          <p>
            Already have an account?{" "}
            <Link href="/login" className="text-blue-500">
              Login
            </Link>
          </p>
        </div>
      </form>
    </div>
  );
}
