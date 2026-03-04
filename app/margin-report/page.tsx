"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import { Download } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { openAndPrintTypewriterReport } from "@/utils/pdfReportTemplate";

interface MarginInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  createdAt: string;
  salesTotal: number;
  margin: number;
}

interface MonthlyMargin {
  month: string;
  invoiceCount: number;
  totalSales: number;
  totalMargin: number;
}

interface MarginResponse {
  summary: {
    invoiceCount: number;
    grandTotalSales: number;
    grandTotalMargin: number;
  };
  monthlySummary: MonthlyMargin[];
  invoices: MarginInvoice[];
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

export default function MarginReportPage() {
  const { toast } = useToast();
  const [data, setData] = useState<MarginResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const loadMarginReport = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.get("/margin-report");
        setData(response.data);
      } catch (error: any) {
        toast({
          title: "Gagal memuat laporan margin",
          description: error?.response?.data?.error || "Silakan coba lagi.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadMarginReport();
  }, [toast]);

  const filteredInvoices = useMemo(() => {
    if (!data?.invoices) return [];
    const keyword = search.trim().toLowerCase();
    if (!keyword) return data.invoices;

    return data.invoices.filter((invoice) => {
      return (
        invoice.invoiceNumber.toLowerCase().includes(keyword) ||
        invoice.customerName.toLowerCase().includes(keyword)
      );
    });
  }, [data, search]);

  const downloadMonthlyXlsx = async () => {
    if (!data?.monthlySummary?.length) {
      toast({ title: "Data kosong", description: "Belum ada data margin bulanan untuk diunduh." });
      return;
    }

    const XLSX = await import("xlsx");
    const rows = data.monthlySummary.map((item) => ({
      Bulan: formatMonth(item.month),
      "Jumlah Faktur": item.invoiceCount,
      "Total Penjualan": item.totalSales,
      "Total Margin": item.totalMargin,
    }));

    const worksheet = XLSX.utils.json_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Margin Bulanan");
    XLSX.writeFile(workbook, `laporan-margin-bulanan-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const downloadMonthlyPdf = () => {
    if (!data?.monthlySummary?.length) {
      toast({ title: "Data kosong", description: "Belum ada data margin bulanan untuk diunduh." });
      return;
    }

    const didOpen = openAndPrintTypewriterReport({
      documentTitle: "Laporan Margin Bulanan",
      reportHeading: "Laporan Margin Bulanan",
      generatedAt: new Date().toLocaleString("id-ID"),
      tableHeaders: ["Bulan", "Jumlah Faktur", "Total Penjualan", "Total Margin"],
      tableRows: data.monthlySummary.map((item) => [
        formatMonth(item.month),
        String(item.invoiceCount),
        formatCurrency(item.totalSales),
        formatCurrency(item.totalMargin),
      ]),
      summaryLines: [
        `Total Faktur: ${data.summary.invoiceCount}`,
        `Grand Total Penjualan: ${formatCurrency(data.summary.grandTotalSales)}`,
        `Grand Total Margin: ${formatCurrency(data.summary.grandTotalMargin)}`,
      ],
    });

    if (!didOpen) {
      toast({ title: "Gagal membuka jendela cetak", description: "Izinkan pop-up browser lalu coba lagi." });
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 p-4 lg:p-0">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-2xl font-bold">Laporan Margin</h2>
            <p className="text-sm text-muted-foreground">Ringkasan margin dari seluruh data faktur yang tersimpan di database.</p>
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={downloadMonthlyPdf}>
              <Download className="h-4 w-4 mr-2" />
              Unduh PDF Margin Bulanan
            </Button>
            <Button type="button" onClick={downloadMonthlyXlsx}>
              <Download className="h-4 w-4 mr-2" />
              Unduh XLSX Margin Bulanan
            </Button>
          </div>
        </div>

        {isLoading ? (
          <Card>
            <CardContent className="py-10 text-center text-sm text-muted-foreground">Memuat laporan margin...</CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Total Faktur</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{data?.summary.invoiceCount || 0}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Grand Total Penjualan</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold">{formatCurrency(data?.summary.grandTotalSales || 0)}</CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Grand Total Margin</CardTitle>
                </CardHeader>
                <CardContent className="text-2xl font-semibold text-emerald-600">{formatCurrency(data?.summary.grandTotalMargin || 0)}</CardContent>
              </Card>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Margin Bulanan</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Bulan</TableHead>
                        <TableHead className="text-right">Jumlah Faktur</TableHead>
                        <TableHead className="text-right">Total Penjualan</TableHead>
                        <TableHead className="text-right">Total Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data?.monthlySummary?.map((item) => (
                        <TableRow key={item.month}>
                          <TableCell className="font-medium">{formatMonth(item.month)}</TableCell>
                          <TableCell className="text-right">{item.invoiceCount}</TableCell>
                          <TableCell className="text-right">{formatCurrency(item.totalSales)}</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(item.totalMargin)}</TableCell>
                        </TableRow>
                      ))}
                      {!data?.monthlySummary?.length && (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center text-muted-foreground">Belum ada data margin bulanan.</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Detail Margin per Faktur</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input
                  placeholder="Cari nomor faktur atau nama pelanggan..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>No. Faktur</TableHead>
                        <TableHead>Pelanggan</TableHead>
                        <TableHead>Tanggal</TableHead>
                        <TableHead className="text-right">Total Penjualan</TableHead>
                        <TableHead className="text-right">Margin</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredInvoices.map((invoice) => (
                        <TableRow key={invoice.id}>
                          <TableCell className="font-medium">{invoice.invoiceNumber}</TableCell>
                          <TableCell>{invoice.customerName}</TableCell>
                          <TableCell>{new Date(invoice.createdAt).toLocaleString("id-ID")}</TableCell>
                          <TableCell className="text-right">{formatCurrency(invoice.salesTotal)}</TableCell>
                          <TableCell className="text-right font-semibold text-emerald-600">{formatCurrency(invoice.margin)}</TableCell>
                        </TableRow>
                      ))}
                      {!filteredInvoices.length && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            Tidak ada data margin yang cocok.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
