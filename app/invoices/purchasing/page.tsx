"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface InvoiceItem {
  name: string;
  quantity: number;
  lineTotal: number;
  supplier: string;
}

interface Invoice {
  id: string;
  createdAt: string;
  items: InvoiceItem[];
}

interface PurchasingDataResponse {
  invoices: Invoice[];
  supplierBreakdown: Array<{
    supplier: string;
    quantity: number;
    revenue: number;
  }>;
  topProducts: Array<{
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    revenue: number;
  }>;
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

export default function InvoicePurchasingPage() {
  const { toast } = useToast();
  const [data, setData] = useState<PurchasingDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadPurchasingData = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.get("/invoices", { params: { limit: 200 } });
        setData(response.data);
      } catch (error: any) {
        toast({
          title: "Failed to load purchasing data",
          description: error?.response?.data?.error || "Please try again in a moment.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadPurchasingData();
  }, [toast]);

  const dailyTrend = useMemo(() => {
    if (!data) return [];
    const grouped = data.invoices.reduce((acc, invoice) => {
      const key = new Date(invoice.createdAt).toLocaleDateString();
      const prev = acc.get(key) || { date: key, quantity: 0, revenue: 0 };
      invoice.items.forEach((item) => {
        prev.quantity += item.quantity;
        prev.revenue += item.lineTotal;
      });
      acc.set(key, prev);
      return acc;
    }, new Map<string, { date: string; quantity: number; revenue: number }>());

    return Array.from(grouped.values()).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [data]);

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 p-4 lg:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Purchasing Review from Invoice Data</h2>
            <p className="text-sm text-muted-foreground">Understand which suppliers and products are moving the fastest.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/invoices/data">
              <Button variant="outline">Invoice Data</Button>
            </Link>
            <Link href="/invoices">
              <Button>Create Invoice</Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading purchasing insights...</CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <CardHeader>
                <CardTitle>Supplier Contribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data?.supplierBreakdown.map((supplier) => (
                  <div key={supplier.supplier} className="rounded border px-3 py-2">
                    <p className="font-medium">{supplier.supplier}</p>
                    <p className="text-sm text-muted-foreground">Items sold: {supplier.quantity}</p>
                    <p className="text-sm">Revenue impact: {formatCurrency(supplier.revenue)}</p>
                  </div>
                ))}
                {!data?.supplierBreakdown.length && (
                  <p className="text-sm text-muted-foreground">Supplier contribution appears after invoice activity.</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Products by Quantity</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {data?.topProducts.map((product) => (
                  <div key={`${product.productId}-${product.sku}`} className="rounded border px-3 py-2">
                    <p className="font-medium">{product.name}</p>
                    <p className="text-sm text-muted-foreground">SKU: {product.sku || "-"}</p>
                    <p className="text-sm">Qty sold: {product.quantity}</p>
                    <p className="text-sm">Revenue: {formatCurrency(product.revenue)}</p>
                  </div>
                ))}
                {!data?.topProducts.length && <p className="text-sm text-muted-foreground">Top products will appear after sales data exists.</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Daily Movement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {dailyTrend.map((day) => (
                  <div key={day.date} className="rounded border px-3 py-2">
                    <p className="font-medium">{day.date}</p>
                    <p className="text-sm text-muted-foreground">Units moved: {day.quantity}</p>
                    <p className="text-sm">Revenue: {formatCurrency(day.revenue)}</p>
                  </div>
                ))}
                {!dailyTrend.length && <p className="text-sm text-muted-foreground">Daily trend appears once invoices are created.</p>}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
