"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";

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
  discountType?: "percentage" | "fixed";
  discountValue?: number;
  discountAmount?: number;
  promoCode?: string;
  taxRate: number;
  taxAmount: number;
  grandTotal: number;
  amountPaid: number;
  changeAmount: number;
  paymentMethod: string;
  createdByName?: string;
  keterangan: string;
  createdAt: string;
  items: InvoiceItem[];
}

interface InvoiceDataResponse {
  invoices: Invoice[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
    search: string;
  };
  summary: {
    revenue: number;
    taxCollected: number;
    invoiceCount: number;
    itemsSold: number;
    averageInvoiceValue: number;
    totalDiscount: number;
  };
}

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

export default function InvoiceDataPage() {
  const { toast } = useToast();
  const [data, setData] = useState<InvoiceDataResponse | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const hasLoadedOnce = useRef(false);

  useEffect(() => {
    const loadInvoiceData = async () => {
      try {
        if (hasLoadedOnce.current) {
          setIsTableLoading(true);
        } else {
          setIsInitialLoading(true);
        }
        const response = await axiosInstance.get("/invoices", { params: { limit: 10, page, search } });
        setData(response.data);
      } catch (error: any) {
        toast({
          title: "Failed to load invoice data",
          description: error?.response?.data?.error || "Please try again in a moment.",
          variant: "destructive",
        });
      } finally {
        setIsInitialLoading(false);
        setIsTableLoading(false);
        hasLoadedOnce.current = true;
      }
    };

    loadInvoiceData();
  }, [toast, page, search]);

  const paymentMethodSummary = useMemo(() => {
    if (!data) return [];

    const grouped = data.invoices.reduce((acc, invoice) => {
      const key = invoice.paymentMethod || "Unknown";
      acc.set(key, (acc.get(key) || 0) + invoice.grandTotal);
      return acc;
    }, new Map<string, number>());

    return Array.from(grouped.entries()).map(([method, value]) => ({ method, value })).sort((a, b) => b.value - a.value);
  }, [data]);

  const selectedInvoice = useMemo(() => {
    if (!data || !selectedInvoiceId) return null;
    return data.invoices.find((invoice) => invoice.id === selectedInvoiceId) || null;
  }, [data, selectedInvoiceId]);

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 p-4 lg:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Invoice Data Review</h2>
            <p className="text-sm text-muted-foreground">Monitor sales invoices before building your final reports.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/invoices/create">
              <Button variant="outline">Create Invoice</Button>
            </Link>
            <Link href="/invoices/purchasing">
              <Button>Purchasing Review</Button>
            </Link>
          </div>
        </div>

        {isInitialLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading invoice data...</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Revenue</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{formatCurrency(data?.summary.revenue || 0)}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Discount Given</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{formatCurrency(data?.summary.totalDiscount || 0)}</CardContent>
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


            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                  <Input
                    placeholder="Search invoice number, customer, promo, payment, note..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="md:max-w-md"
                  />
                  <p className="text-sm text-muted-foreground">
                    Showing {data?.invoices.length || 0} of {data?.pagination.totalCount || 0} invoices {isTableLoading ? "(updating...)" : ""}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Recent Invoices</CardTitle>
                </CardHeader>
                <CardContent>
                  {isTableLoading && <p className="text-xs text-muted-foreground mb-2">Loading recent invoices...</p>}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="px-2 py-2">Invoice</th>
                          <th className="px-2 py-2">Customer</th>
                          <th className="px-2 py-2">Date</th>
                          <th className="px-2 py-2">Payment</th>
                          <th className="px-2 py-2">Input By</th>
                          <th className="px-2 py-2 text-right">Total</th>
                          <th className="px-2 py-2 text-right">Detail</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data?.invoices.map((invoice) => (
                          <tr key={invoice.id} className="border-b">
                            <td className="px-2 py-2 font-medium">{invoice.invoiceNumber}</td>
                            <td className="px-2 py-2">{invoice.customerName}</td>
                            <td className="px-2 py-2">{new Date(invoice.createdAt).toLocaleString()}</td>
                            <td className="px-2 py-2">{invoice.paymentMethod}</td>
                            <td className="px-2 py-2">{invoice.createdByName || "admin"}</td>
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


            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Page {data?.pagination.page || 1} of {data?.pagination.totalPages || 1}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={!data?.pagination.hasPrev || isTableLoading}
                >
                  Previous
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={!data?.pagination.hasNext || isTableLoading}
                >
                  Next
                </Button>
              </div>
            </div>

            {selectedInvoice && (
              <Card>
                <CardHeader>
                  <CardTitle>Invoice Detail - {selectedInvoice.invoiceNumber}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid gap-2 md:grid-cols-2 text-sm">
                    <p><span className="font-medium">Customer:</span> {selectedInvoice.customerName}</p>
                    <p><span className="font-medium">Date:</span> {new Date(selectedInvoice.createdAt).toLocaleString()}</p>
                    <p><span className="font-medium">Payment:</span> {selectedInvoice.paymentMethod}</p>
                    <p><span className="font-medium">Input By:</span> {selectedInvoice.createdByName || "admin"}</p>
                    <p><span className="font-medium">Promo:</span> {selectedInvoice.promoCode || "-"}</p>
                    <p><span className="font-medium">Discount:</span> {formatCurrency(selectedInvoice.discountAmount || 0)} ({selectedInvoice.discountType === "percentage" ? `${selectedInvoice.discountValue || 0}%` : formatCurrency(selectedInvoice.discountValue || 0)})</p>
                    <p><span className="font-medium">Tax:</span> {formatCurrency(selectedInvoice.taxAmount)} ({selectedInvoice.taxRate}%)</p>
                    <p className="md:col-span-2"><span className="font-medium">Note:</span> {selectedInvoice.keterangan || "-"}</p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="px-2 py-2">Product</th>
                          <th className="px-2 py-2">SKU</th>
                          <th className="px-2 py-2">Supplier</th>
                          <th className="px-2 py-2">Qty</th>
                          <th className="px-2 py-2">Price</th>
                          <th className="px-2 py-2 text-right">Line Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedInvoice.items.map((item) => (
                          <tr key={`${selectedInvoice.id}-${item.productId}-${item.sku}`} className="border-b">
                            <td className="px-2 py-2">{item.name}</td>
                            <td className="px-2 py-2">{item.sku}</td>
                            <td className="px-2 py-2">{item.supplier}</td>
                            <td className="px-2 py-2">{item.quantity}</td>
                            <td className="px-2 py-2">{formatCurrency(item.price)}</td>
                            <td className="px-2 py-2 text-right">{formatCurrency(item.lineTotal)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="text-right space-y-1 text-sm">
                    <p>Subtotal: {formatCurrency(selectedInvoice.totalAmount)}</p>
                    <p>Discount: -{formatCurrency(selectedInvoice.discountAmount || 0)}</p>
                    <p>Tax: {formatCurrency(selectedInvoice.taxAmount)}</p>
                    <p className="text-base font-semibold">Grand Total: {formatCurrency(selectedInvoice.grandTotal)}</p>
                    <p>Amount Paid: {formatCurrency(selectedInvoice.amountPaid)}</p>
                    <p>Change: {formatCurrency(selectedInvoice.changeAmount)}</p>
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
