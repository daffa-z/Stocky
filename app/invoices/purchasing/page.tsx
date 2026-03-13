"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { openAndPrintTypewriterReport } from "@/utils/pdfReportTemplate";

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
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
    search: string;
  };
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



interface MonthlySalesSummary {
  month: string;
  invoiceCount: number;
  totalSales: number;
  totalTax: number;
  totalDiscount: number;
}

interface MonthlySalesResponse {
  summary: {
    invoiceCount: number;
    totalSales: number;
    totalTax: number;
    totalDiscount: number;
  };
  monthlySales: MonthlySalesSummary[];
}
const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const formatMonth = (monthKey: string) => {
  const [year, month] = monthKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, (month || 1) - 1, 1));
  return date.toLocaleDateString("id-ID", { month: "long", year: "numeric" });
};

export default function InvoicePurchasingPage() {
  const { toast } = useToast();
  const [data, setData] = useState<PurchasingDataResponse | null>(null);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isTableLoading, setIsTableLoading] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [monthlySalesData, setMonthlySalesData] = useState<MonthlySalesResponse | null>(null);

  const hasInitializedTableRefresh = useRef(false);

  useEffect(() => {
    const loadInitialPurchasingData = async () => {
      try {
        setIsInitialLoading(true);
        const [invoiceResponse, monthlySalesResponse] = await Promise.all([
          axiosInstance.get("/invoices", { params: { limit: 10, page: 1, search: "" } }),
          axiosInstance.get("/invoices/monthly-sales"),
        ]);
        setData(invoiceResponse.data);
        setMonthlySalesData(monthlySalesResponse.data);
      } catch (error: any) {
        toast({
          title: "Gagal memuat data pembelian",
          description: error?.response?.data?.error || "Silakan coba lagi sebentar lagi.",
          variant: "destructive",
        });
      } finally {
        setIsInitialLoading(false);
      }
    };

    loadInitialPurchasingData();
  }, [toast]);

  useEffect(() => {
    if (!hasInitializedTableRefresh.current) {
      hasInitializedTableRefresh.current = true;
      return;
    }

    const loadInvoiceTable = async () => {
      try {
        setIsTableLoading(true);
        const invoiceResponse = await axiosInstance.get("/invoices", { params: { limit: 10, page, search } });
        setData((prev) => {
          if (!prev) return invoiceResponse.data;
          return {
            ...prev,
            invoices: invoiceResponse.data.invoices,
            pagination: invoiceResponse.data.pagination,
          };
        });
        setSelectedInvoiceId(null);
      } catch (error: any) {
        toast({
          title: "Gagal memuat data faktur",
          description: error?.response?.data?.error || "Silakan coba lagi sebentar lagi.",
          variant: "destructive",
        });
      } finally {
        setIsTableLoading(false);
      }
    };

    loadInvoiceTable();
  }, [page, search, toast]);

  const selectedInvoice = useMemo(() => {
    if (!data || !selectedInvoiceId) return null;
    return data.invoices.find((invoice) => invoice.id === selectedInvoiceId) || null;
  }, [data, selectedInvoiceId]);

  const downloadMonthlySalesXlsx = async () => {
    if (!monthlySalesData?.monthlySales?.length) {
      toast({ title: "Data kosong", description: "Belum ada data penjualan bulanan untuk diunduh." });
      return;
    }

    const XLSX = await import("xlsx");
    const rows = monthlySalesData.monthlySales.map((item) => ({
      Bulan: formatMonth(item.month),
      "Jumlah Faktur": item.invoiceCount,
      "Total Penjualan": item.totalSales,
      "Total Pajak": item.totalTax,
      "Total Diskon": item.totalDiscount,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Penjualan Bulanan");
    XLSX.writeFile(workbook, `laporan-penjualan-bulanan-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadMonthlySalesPdf = () => {
    if (!monthlySalesData?.monthlySales?.length) {
      toast({ title: "Data kosong", description: "Belum ada data penjualan bulanan untuk diunduh." });
      return;
    }

    const didOpen = openAndPrintTypewriterReport({
      documentTitle: "Laporan Penjualan Bulanan",
      reportHeading: "Laporan Penjualan Bulanan",
      generatedAt: new Date().toLocaleString("id-ID"),
      tableHeaders: ["Bulan", "Jumlah Faktur", "Total Penjualan", "Total Pajak", "Total Diskon"],
      tableRows: monthlySalesData.monthlySales.map((item) => [
        formatMonth(item.month),
        String(item.invoiceCount),
        formatCurrency(item.totalSales),
        formatCurrency(item.totalTax),
        formatCurrency(item.totalDiscount),
      ]),
      summaryLines: [
        `Total Faktur: ${monthlySalesData.summary.invoiceCount}`,
        `Total Penjualan: ${formatCurrency(monthlySalesData.summary.totalSales)}`,
        `Total Pajak: ${formatCurrency(monthlySalesData.summary.totalTax)}`,
        `Total Diskon: ${formatCurrency(monthlySalesData.summary.totalDiscount)}`,
      ],
    });

    if (!didOpen) {
      toast({ title: "Gagal membuka jendela cetak", description: "Izinkan pop-up browser lalu coba lagi." });
    }
  };

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
            <h2 className="text-2xl font-bold">Tinjauan Pembelian dari Data Faktur</h2>
            <p className="text-sm text-muted-foreground">Pahami pemasok dan produk yang pergerakannya paling cepat.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={downloadMonthlySalesPdf}>Unduh PDF Laporan Penjualan</Button>
            <Button type="button" onClick={downloadMonthlySalesXlsx}>Unduh XLSX Laporan Penjualan</Button>
            <Link href="/invoices/data">
              <Button variant="outline">Data Faktur</Button>
            </Link>
            <Link href="/invoices/create">
              <Button>Buat Faktur</Button>
            </Link>
          </div>
        </div>

        {isInitialLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Memuat insight pembelian...</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Kontribusi Pemasok</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data?.supplierBreakdown.map((supplier) => (
                    <div key={supplier.supplier} className="rounded border px-3 py-2">
                      <p className="font-medium">{supplier.supplier}</p>
                      <p className="text-sm text-muted-foreground">Produk terjual: {supplier.quantity}</p>
                      <p className="text-sm">Dampak pendapatan: {formatCurrency(supplier.revenue)}</p>
                    </div>
                  ))}
                  {!data?.supplierBreakdown.length && (
                    <p className="text-sm text-muted-foreground">Kontribusi pemasok muncul setelah ada aktivitas faktur.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Produk Teratas berdasarkan Kuantitas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {data?.topProducts.map((product) => (
                    <div key={`${product.productId}-${product.sku}`} className="rounded border px-3 py-2">
                      <p className="font-medium">{product.name}</p>
                      <p className="text-sm text-muted-foreground">SKU: {product.sku || "-"}</p>
                      <p className="text-sm">Qty terjual: {product.quantity}</p>
                      <p className="text-sm">Pendapatan: {formatCurrency(product.revenue)}</p>
                    </div>
                  ))}
                  {!data?.topProducts.length && <p className="text-sm text-muted-foreground">Produk teratas muncul setelah data penjualan tersedia.</p>}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Pergerakan Harian</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {dailyTrend.map((day) => (
                    <div key={day.date} className="rounded border px-3 py-2">
                      <p className="font-medium">{day.date}</p>
                      <p className="text-sm text-muted-foreground">Unit bergerak: {day.quantity}</p>
                      <p className="text-sm">Pendapatan: {formatCurrency(day.revenue)}</p>
                    </div>
                  ))}
                  {!dailyTrend.length && <p className="text-sm text-muted-foreground">Tren harian muncul setelah faktur dibuat.</p>}
                </CardContent>
              </Card>
            </div>



            <Card>
              <CardHeader>
                <CardTitle>Penjualan Bulanan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-2 py-2">Bulan</th>
                        <th className="px-2 py-2 text-right">Jumlah Faktur</th>
                        <th className="px-2 py-2 text-right">Total Penjualan</th>
                        <th className="px-2 py-2 text-right">Total Pajak</th>
                        <th className="px-2 py-2 text-right">Total Diskon</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlySalesData?.monthlySales?.map((month) => (
                        <tr key={month.month} className="border-b">
                          <td className="px-2 py-2">{formatMonth(month.month)}</td>
                          <td className="px-2 py-2 text-right">{month.invoiceCount}</td>
                          <td className="px-2 py-2 text-right">{formatCurrency(month.totalSales)}</td>
                          <td className="px-2 py-2 text-right">{formatCurrency(month.totalTax)}</td>
                          <td className="px-2 py-2 text-right">{formatCurrency(month.totalDiscount)}</td>
                        </tr>
                      ))}
                      {!monthlySalesData?.monthlySales?.length && (
                        <tr>
                          <td colSpan={5} className="px-2 py-4 text-center text-muted-foreground">
                            Belum ada data penjualan bulanan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
                  <Input
                    placeholder="Cari faktur/pelanggan/promo/pembayaran..."
                    value={search}
                    onChange={(e) => {
                      setSearch(e.target.value);
                      setPage(1);
                    }}
                    className="md:max-w-md"
                  />
                  <p className="text-sm text-muted-foreground">
                    Menampilkan {data?.invoices.length || 0} dari {data?.pagination.totalCount || 0} faktur
                  </p>
                </div>
              </CardContent>
            </Card>


            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle>Data Faktur (dengan Detail)</CardTitle>
                  {isTableLoading && <p className="text-xs text-muted-foreground">Memperbarui tabel...</p>}
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left">
                        <th className="px-2 py-2">Faktur</th>
                        <th className="px-2 py-2">Date</th>
                        <th className="px-2 py-2">Promo</th>
                        <th className="px-2 py-2 text-right">Diskon</th>
                        <th className="px-2 py-2 text-right">Pajak</th>
                        <th className="px-2 py-2 text-right">Total Akhir</th>
                        <th className="px-2 py-2 text-right">Aksi</th>
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
                              Lihat Detail
                            </Button>
                          </td>
                        </tr>
                      ))}
                      {!data?.invoices.length && (
                        <tr>
                          <td colSpan={7} className="px-2 py-4 text-center text-muted-foreground">
                            Tidak ada data faktur untuk ditampilkan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>


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
              <Card>
                <CardHeader>
                  <CardTitle>Detail Dampak Pembelian - {selectedInvoice.invoiceNumber}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                    <p><span className="font-medium">Pelanggan:</span> {selectedInvoice.customerName}</p>
                    <p><span className="font-medium">Pembayaran:</span> {selectedInvoice.paymentMethod}</p>
                    <p><span className="font-medium">Promo:</span> {selectedInvoice.promoCode || "-"}</p>
                    <p><span className="font-medium">Diskon:</span> {formatCurrency(selectedInvoice.discountAmount || 0)}</p>
                    <p><span className="font-medium">Pajak:</span> {formatCurrency(selectedInvoice.taxAmount)}</p>
                    <p><span className="font-medium">Total Akhir:</span> {formatCurrency(selectedInvoice.grandTotal)}</p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="px-2 py-2">Pemasok</th>
                          <th className="px-2 py-2">Produk</th>
                          <th className="px-2 py-2">Qty</th>
                          <th className="px-2 py-2 text-right">Pendapatan</th>
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
