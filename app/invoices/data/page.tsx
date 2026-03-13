"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import Image from "next/image";
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
  signatureName?: string;
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
          title: "Gagal memuat data faktur",
          description: error?.response?.data?.error || "Silakan coba lagi sebentar lagi.",
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
            <h2 className="text-2xl font-bold">Tinjauan Data Faktur</h2>
            <p className="text-sm text-muted-foreground">Pantau faktur penjualan sebelum membuat laporan akhir.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/invoices/create">
              <Button variant="outline">Buat Faktur</Button>
            </Link>
            <Link href="/invoices/purchasing">
              <Button>Tinjauan Pembelian</Button>
            </Link>
          </div>
        </div>

        {isInitialLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Memuat data faktur...</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Pendapatan</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{formatCurrency(data?.summary.revenue || 0)}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Total Diskon</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{formatCurrency(data?.summary.totalDiscount || 0)}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Pajak Terkumpul</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{formatCurrency(data?.summary.taxCollected || 0)}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Jumlah Faktur</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{data?.summary.invoiceCount || 0}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Produk Terjual</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{data?.summary.itemsSold || 0}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Rata-rata Nilai Faktur</CardTitle>
                </CardHeader>
                <CardContent className="text-xl font-semibold">{formatCurrency(data?.summary.averageInvoiceValue || 0)}</CardContent>
              </Card>
            </div>


            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                  <Input
                    placeholder="Cari nomor faktur, pelanggan, promo, pembayaran, catatan..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="md:max-w-md"
                  />
                  <p className="text-sm text-muted-foreground">
                    Menampilkan {data?.invoices.length || 0} dari {data?.pagination.totalCount || 0} faktur {isTableLoading ? "(memperbarui...)" : ""}
                  </p>
                </div>
              </CardContent>
            </Card>

            <div className="grid gap-4 lg:grid-cols-5">
              <Card className="lg:col-span-3">
                <CardHeader>
                  <CardTitle>Faktur Terbaru</CardTitle>
                </CardHeader>
                <CardContent>
                  {isTableLoading && <p className="text-xs text-muted-foreground mb-2">Memuat faktur terbaru...</p>}
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="px-2 py-2">Faktur</th>
                          <th className="px-2 py-2">Pelanggan</th>
                          <th className="px-2 py-2">Date</th>
                          <th className="px-2 py-2">Pembayaran</th>
                          <th className="px-2 py-2">Diinput Oleh</th>
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
                                Lihat Detail
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!data?.invoices.length && <p className="py-6 text-center text-muted-foreground">Belum ada data faktur.</p>}
                  </div>
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle>Komposisi Metode Pembayaran</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {paymentMethodSummary.map((payment) => (
                    <div key={payment.method} className="flex items-center justify-between rounded border px-3 py-2">
                      <Badge variant="outline">{payment.method}</Badge>
                      <span className="font-medium">{formatCurrency(payment.value)}</span>
                    </div>
                  ))}
                  {!paymentMethodSummary.length && (
                    <p className="text-sm text-muted-foreground">Data metode pembayaran akan muncul setelah ada faktur.</p>
                  )}
                </CardContent>
              </Card>
            </div>


            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                Halaman {data?.pagination.page || 1} dari {data?.pagination.totalPages || 1}
              </p>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                  disabled={!data?.pagination.hasPrev || isTableLoading}
                >
                  Sebelumnya
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setPage((prev) => prev + 1)}
                  disabled={!data?.pagination.hasNext || isTableLoading}
                >
                  Berikutnya
                </Button>
              </div>
            </div>

            {selectedInvoice && (
              <Card className="font-mono invoice-print-compact">
                <CardHeader>
                  <CardTitle>Detail Faktur - {selectedInvoice.invoiceNumber}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {selectedInvoice.customerName} • {new Date(selectedInvoice.createdAt).toLocaleString()}
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="mb-4">
                    <Image
                      src="/pdf-header-template.svg"
                      alt="Header Koperasi"
                      width={2048}
                      height={357}
                      className="w-full h-auto"
                    />
                  </div>

                  <h3 className="text-xl font-bold mb-3 text-center">Rincian Transaksi Penjualan</h3>
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="py-2">Produk</th>
                        <th className="py-2">SKU</th>
                        <th className="py-2">Pemasok</th>
                        <th className="py-2">Qty</th>
                        <th className="py-2">Harga</th>
                        <th className="py-2 text-right">Line Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedInvoice.items.map((item) => (
                        <tr key={`${selectedInvoice.id}-${item.productId}-${item.sku}`} className="border-b">
                          <td className="py-2">{item.name}</td>
                          <td className="py-2">{item.sku}</td>
                          <td className="py-2">{item.supplier}</td>
                          <td className="py-2">{item.quantity}</td>
                          <td className="py-2">{formatCurrency(item.price)}</td>
                          <td className="py-2 text-right">{formatCurrency(item.lineTotal)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 text-right space-y-1 text-sm">
                    <p>Metode Pembayaran: {selectedInvoice.paymentMethod}</p>
                    <p>Diinput Oleh: {selectedInvoice.createdByName || "admin"}</p>
                    <p>Subtotal: {formatCurrency(selectedInvoice.totalAmount)}</p>
                    <p>Kode Promo: {selectedInvoice.promoCode || "-"}</p>
                    <p>
                      Discount ({selectedInvoice.discountType === "percentage" ? `${selectedInvoice.discountValue || 0}%` : formatCurrency(selectedInvoice.discountValue || 0)}): -
                      {formatCurrency(selectedInvoice.discountAmount || 0)}
                    </p>
                    <p>Tax ({selectedInvoice.taxRate}%): {formatCurrency(selectedInvoice.taxAmount)}</p>
                    <p className="font-semibold text-base">Total Akhir: {formatCurrency(selectedInvoice.grandTotal)}</p>
                    <p>Jumlah Dibayar: {formatCurrency(selectedInvoice.amountPaid)}</p>
                    <p>Kembalian: {formatCurrency(selectedInvoice.changeAmount)}</p>
                    <p>Keterangan: {selectedInvoice.keterangan || "-"}</p>
                  </div>

                  <div className="mt-10 flex justify-end">
                    <div className="text-center min-w-56">
                      <p>{new Date(selectedInvoice.createdAt).toLocaleDateString("id-ID")}</p>
                      <p className="mb-16">Mengetahui,</p>
                      <p className="font-semibold underline">{selectedInvoice.signatureName || "Ari Wibowo"}</p>
                    </div>
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
