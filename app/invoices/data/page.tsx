"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface InvoiceItem {
  productId: string;
  name: string;
  sku: string;
  supplier: string;
  price: number;
  quantity: number;
  lineTotal: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  totalAmount: number;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  amountPaid: number;
  changeAmount: number;
  paymentMethod: string;
  keterangan: string;
  createdAt: string;
  items: InvoiceItem[];
}

interface InvoiceDataResponse {
  invoices: Invoice[];
  summary: {
    revenue: number;
    taxCollected: number;
    invoiceCount: number;
    itemsSold: number;
    averageInvoiceValue: number;
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(value);

export default function InvoiceDataPage() {
  const { toast } = useToast();
  const [data, setData] = useState<InvoiceDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadInvoiceData = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.get("/invoices", { params: { limit: 100 } });
        setData(response.data);
      } catch (error: any) {
        toast({
          title: "Failed to load invoice data",
          description: error?.response?.data?.error || "Please try again in a moment.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadInvoiceData();
  }, [toast]);

  const paymentMethodSummary = useMemo(() => {
    if (!data) return [];

    const grouped = data.invoices.reduce((acc, invoice) => {
      const key = invoice.paymentMethod || "Unknown";
      acc.set(key, (acc.get(key) || 0) + invoice.grandTotal);
      return acc;
    }, new Map<string, number>());

    return Array.from(grouped.entries()).map(([method, value]) => ({ method, value })).sort((a, b) => b.value - a.value);
  }, [data]);

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 p-4 lg:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Invoice Data Review</h2>
            <p className="text-sm text-muted-foreground">Monitor sales invoices before building your final reports.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/invoices">
              <Button variant="outline">Create Invoice</Button>
            </Link>
            <Link href="/invoices/purchasing">
              <Button>Purchasing Review</Button>
            </Link>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading invoice data...</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Revenue</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{formatCurrency(data?.summary.revenue || 0)}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Tax Collected</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{formatCurrency(data?.summary.taxCollected || 0)}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Invoices</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{data?.summary.invoiceCount || 0}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Items Sold</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{data?.summary.itemsSold || 0}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Avg. Invoice Value</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{formatCurrency(data?.summary.averageInvoiceValue || 0)}</CardContent>
              </Card>
            </div>

            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Recent Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="px-2 py-2">Invoice</th>
                          <th className="px-2 py-2">Customer</th>
                          <th className="px-2 py-2">Date</th>
                          <th className="px-2 py-2">Payment</th>
                          <th className="px-2 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data?.invoices.map((invoice) => (
                          <tr key={invoice.id} className="border-b">
                            <td className="px-2 py-2 font-medium">{invoice.invoiceNumber}</td>
                            <td className="px-2 py-2">{invoice.customerName}</td>
                            <td className="px-2 py-2">{new Date(invoice.createdAt).toLocaleString()}</td>
                            <td className="px-2 py-2">{invoice.paymentMethod}</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(invoice.grandTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!data?.invoices.length && <p className="py-6 text-center text-muted-foreground">No invoice data found yet.</p>}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Payment Method Mix</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {paymentMethodSummary.map((payment) => (
                    <div key={payment.method} className="flex items-center justify-between rounded border px-3 py-2">
                      <Badge variant="outline">{payment.method}</Badge>
                      <span className="font-medium">{formatCurrency(payment.value)}</span>
                    </div>
                  ))}
                  {!paymentMethodSummary.length && (
                    <p className="text-sm text-muted-foreground">Payment method data will appear after the first invoice.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
