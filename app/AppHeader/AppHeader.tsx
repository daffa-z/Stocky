"use client";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AiFillProduct } from "react-icons/ai";
import { FaTruck } from "react-icons/fa";
import { FiActivity, FiBarChart, FiFileText, FiHome, FiUsers } from "react-icons/fi";
import { HiOutlineReceiptTax } from "react-icons/hi";
import { useAuth } from "../authContext";
import { ModeToggle } from "./ModeToggle";

export default function AppHeader() {
  const { logout, user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const role = (user?.role || "USER").toUpperCase();
  const isAdmin = role === "ADMIN";
  const isDev = role === "DEV";
  const canAccessMainFeatures = isAdmin || isDev;

  const handleLogout = async () => {
    setIsLoggingOut(true);

    try {
      await logout();
      toast({
        title: "Berhasil keluar!",
        description: "Anda berhasil keluar.",
      });

      setTimeout(() => {
        router.push("/login");
      }, 1500);
    } catch (error) {
      toast({
        title: "Gagal keluar",
        description: "Gagal keluar. Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleNavigation = (path: string) => {
    router.push(path);
  };

  return (
    <div className="p-4 flex flex-col sm:flex-row justify-between items-center bg-primary text-primary-foreground rounded-lg shadow-md">
      <div className="flex items-center gap-4">
        <div
          className="flex aspect-square size-10 items-center justify-center rounded-lg bg-primary-dark text-primary-foreground cursor-pointer"
          onClick={() => handleNavigation("/")}
        >
          <AiFillProduct className="text-3xl" />
        </div>
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-bold">Selamat datang, {user?.name}!</h1>
          <p className="text-sm">{user?.email}</p>
        </div>
      </div>

      <div className="flex items-center space-x-2 mt-4 sm:mt-0">
        {canAccessMainFeatures && (
          <>
            <Button variant="ghost" size="sm" onClick={() => handleNavigation("/")} className="text-primary-foreground hover:bg-primary-dark">
              <FiHome className="mr-2 h-4 w-4" />
              Dasbor
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleNavigation("/business-insights")}
              className="text-primary-foreground hover:bg-primary-dark"
            >
              <FiBarChart className="mr-2 h-4 w-4" />
              Wawasan Bisnis
            </Button>
          </>
        )}

        <Button variant="ghost" size="sm" onClick={() => handleNavigation("/invoices")} className="text-primary-foreground hover:bg-primary-dark">
          <HiOutlineReceiptTax className="mr-2 h-4 w-4" />
          Faktur
        </Button>

        {canAccessMainFeatures && (
          <>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="text-primary-foreground hover:bg-primary-dark">
                  <FiFileText className="mr-2 h-4 w-4" />
                  Laporan
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start">
                <DropdownMenuItem onClick={() => handleNavigation("/invoices/purchasing")}>Laporan Penjualan</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation("/stock-movement")}>Laporan Detail Pergerakan Stock</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleNavigation("/margin-report")}>Laporan Margin</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" onClick={() => handleNavigation("/suppliers")} className="text-primary-foreground hover:bg-primary-dark">
              <FaTruck className="mr-2 h-4 w-4" />
              Supplier
            </Button>

            <Button variant="ghost" size="sm" onClick={() => handleNavigation("/users")} className="text-primary-foreground hover:bg-primary-dark">
              <FiUsers className="mr-2 h-4 w-4" />
              Pengguna
            </Button>

            {isDev && (
              <>
                <Button variant="ghost" size="sm" onClick={() => handleNavigation("/api-docs")} className="text-primary-foreground hover:bg-primary-dark">
                  <FiFileText className="mr-2 h-4 w-4" />
                  Dokumentasi API
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleNavigation("/api-status")} className="text-primary-foreground hover:bg-primary-dark">
                  <FiActivity className="mr-2 h-4 w-4" />
                  Status API
                </Button>
              </>
            )}
          </>
        )}

        <ModeToggle />
        <Button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="h-10 px-6 bg-secondary text-secondary-foreground shadow-lg hover:shadow-xl hover:bg-secondary-dark transition-all"
        >
          {isLoggingOut ? "Sedang keluar..." : "Keluar"}
        </Button>
      </div>
    </div>
  );
}
