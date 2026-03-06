"use client";

import { Card } from "@/components/ui/card";
import React, { useEffect } from "react";
import AppHeader from "../AppHeader/AppHeader";
import { useAuth } from "../authContext";
import { usePathname, useRouter } from "next/navigation";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
  showHeader?: boolean;
}

const AuthenticatedLayout: React.FC<AuthenticatedLayoutProps> = ({
  children,
  showHeader = true
}) => {
  const { user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const role = (user?.role || "USER").toUpperCase();
  const isAdmin = role === "ADMIN";
  const isDev = role === "DEV";
  const canAccessMainFeatures = isAdmin || isDev;

  const isInvoiceRoute = pathname?.startsWith("/invoices");
  const isDeveloperOnlyRoute = pathname?.startsWith("/api-docs") || pathname?.startsWith("/api-status");

  const isRestrictedForUserRole = Boolean(user) && !canAccessMainFeatures && !isInvoiceRoute;
  const isRestrictedForNonDev = Boolean(user) && isDeveloperOnlyRoute && !isDev;

  useEffect(() => {
    if (!user) return;

    if (isRestrictedForNonDev) {
      router.replace("/");
      return;
    }

    if (isRestrictedForUserRole) {
      router.replace("/invoices");
    }
  }, [isRestrictedForNonDev, isRestrictedForUserRole, user, router]);

  return (
    <div className="poppins w-full min-h-screen bg-gray-50 dark:bg-[#121212]">
      {/* Responsive Card */}
      <Card className="flex flex-col shadow-none space-y-4 lg:space-y-6 lg:mx-8 lg:my-6 lg:rounded-lg lg:border lg:shadow-md">
        {/* Header Section */}
        {showHeader && <div className="print:hidden"><AppHeader /></div>}

        {/* Main Content */}
        <div className="p-0 lg:p-4">
          {isRestrictedForUserRole || isRestrictedForNonDev ? null : children}
        </div>
      </Card>
    </div>
  );
};

export default AuthenticatedLayout;
