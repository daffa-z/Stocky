"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

interface InvoiceItem {
  productId: string;
  sku: string;
  name: string;
  quantity: number;
  lineTotal: number;
  supplier: string;
  price: number;
}

interface Invoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  totalAmount: number;
  taxRate: number;
  taxAmount: number;
  discountType?: "percentage" | "fixed";
  discountValue?: number;
  discountAmount?: number;
  promoCode?: string;
  grandTotal: number;
  amountPaid: number;
  changeAmount: number;
  paymentMethod: string;
  keterangan: string;
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
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export default function InvoicePurchasingPage() {
  const { toast } = useToast();
  const [data, setData] = useState<PurchasingDataResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

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

  const selectedInvoice = useMemo(() => {
    if (!data || !selectedInvoiceId) return null;
    return data.invoices.find((invoice) => invoice.id === selectedInvoiceId) || null;
  }, [data, selectedInvoiceId]);

  const dailyTrend = useMemo(() => {
    if (!data) return [];
    const grouped = data.invoices.reduce((acc, invoice) => {
      const key = new Date(invoice.createdAt).toLocaleDateString("id-ID");
      const prev = acc.get(key) || { date: key, quantity: 0, revenue: 0 };
      invoice.items.forEach((item) => {
        prev.quantity += item.quantity;
        prev.revenue += item.lineTotal;
      });
      acc.set(key, prev);
      return acc;
    }, new Map<string, { date: string; quantity: number; revenue: number }>());

    return Array.from(grouped.values());
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
          <>
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

            <Card>
              <CardHeader>
                <CardTitle>Invoice Records (with Detail)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-2 py-2">Invoice</th>
                        <th className="px-2 py-2">Date</th>
                        <th className="px-2 py-2">Promo</th>
                        <th className="px-2 py-2 text-right">Discount</th>
                        <th className="px-2 py-2 text-right">Tax</th>
                        <th className="px-2 py-2 text-right">Grand Total</th>
                        <th className="px-2 py-2 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data?.invoices.map((invoice) => (
                        <tr key={invoice.id} className="border-b">
                          <td className="px-2 py-2">{invoice.invoiceNumber}</td>
                          <td className="px-2 py-2">{new Date(invoice.createdAt).toLocaleString("id-ID")}</td>
                          <td className="px-2 py-2">{invoice.promoCode || "-"}</td>
                          <td className="px-2 py-2 text-right">{formatCurrency(invoice.discountAmount || 0)}</td>
                          <td className="px-2 py-2 text-right">{formatCurrency(invoice.taxAmount)}</td>
                          <td className="px-2 py-2 text-right">{formatCurrency(invoice.grandTotal)}</td>
                          <td className="px-2 py-2 text-right">
                            <Button type="button" size="sm" variant="outline" onClick={() => setSelectedInvoiceId(invoice.id)}>
                              View Detail
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            {selectedInvoice && (
              <Card>
                <CardHeader>
                  <CardTitle>Purchasing Impact Detail - {selectedInvoice.invoiceNumber}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <p><span className="font-medium">Customer:</span> {selectedInvoice.customerName}</p>
                    <p><span className="font-medium">Payment:</span> {selectedInvoice.paymentMethod}</p>
                    <p><span className="font-medium">Promo:</span> {selectedInvoice.promoCode || "-"}</p>
                    <p><span className="font-medium">Discount:</span> {formatCurrency(selectedInvoice.discountAmount || 0)}</p>
                    <p><span className="font-medium">Tax:</span> {formatCurrency(selectedInvoice.taxAmount)}</p>
                    <p><span className="font-medium">Grand Total:</span> {formatCurrency(selectedInvoice.grandTotal)}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="px-2 py-2">Supplier</th>
                          <th className="px-2 py-2">Product</th>
                          <th className="px-2 py-2">Qty</th>
                          <th className="px-2 py-2 text-right">Revenue</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.items.map((item) => (
                          <tr key={`${selectedInvoice.id}-${item.productId}-${item.sku}`} className="border-b">
                            <td className="px-2 py-2">{item.supplier}</td>
                            <td className="px-2 py-2">{item.name}</td>
                            <td className="px-2 py-2">{item.quantity}</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(item.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
