"use client";

import { useAuth } from "@/app/authContext";
import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import axios from "axios";
import { Category, Product } from "@/app/types";
import { useProductStore } from "@/app/useProductStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import { openAndPrintTypewriterReport } from "@/utils/pdfReportTemplate";
import { ArrowRight, FileSpreadsheet, PlusCircle, Printer, Trash2, X } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";
import * as XLSX from "xlsx";

interface InvoiceItemForm {
  productId: string;
  quantity: number;
}

type ImportIssue = {
  row: number;
  message: string;
};

interface CreatedInvoice {
  id: string;
  invoiceNumber: string;
  customerName: string;
  totalAmount: number;
  taxRate: number;
  taxAmount: number;
  discountType: "percentage" | "fixed";
  discountValue: number;
  discountAmount: number;
  promoCode: string;
  grandTotal: number;
  amountPaid: number;
  changeAmount: number;
  paymentMethod: string;
  bankName: string;
  keterangan: string;
  signatureName: string;
  createdByName?: string;
  createdAt: string;
  items: Array<{
    productId: string;
    name: string;
    sku: string;
    supplier: string;
    price: number;
    quantity: number;
    lineTotal: number;
  }>;
}

const PAYMENT_METHODS = ["Tunai", "Bank Transfer", "Kartu Debit/Kredit", "E-Wallet", "QRIS"] as const;
const BANK_OPTIONS = ["BRI", "MANDIRI", "BCA", "BNI"] as const;

const formatCurrency = (value: number) =>
  new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);

const normalizeImportHeader = (value: unknown) =>
  String(value ?? "").replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_-]+/g, "");

const getImportErrorMessage = (error: unknown, fallback: string) => {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error || error.response?.data?.message || fallback;
  }
  return error instanceof Error ? error.message : fallback;
};

const getOrCreateImportCategory = async (categories: Category[], userId: string): Promise<string> => {
  const existingCategory = categories[0];
  if (existingCategory) return existingCategory.id;

  const response = await axiosInstance.post("/categories", { name: "Produk Impor", userId });
  if (!response.data?.id) throw new Error("Kategori impor tidak dapat dibuat.");
  return response.data.id as string;
};

const getOrCreateSupplier = async (supplierName: string, supplierByName: Map<string, string>, userId: string): Promise<string> => {
  const normalizedName = supplierName.toLowerCase();
  const existingSupplierId = supplierByName.get(normalizedName);
  if (existingSupplierId) return existingSupplierId;

  const response = await axiosInstance.post("/suppliers", { name: supplierName, userId });
  if (!response.data?.id) throw new Error("Pemasok tidak dapat dibuat.");
  const supplierId = response.data.id as string;
  supplierByName.set(normalizedName, supplierId);
  return supplierId;
};

export default function InvoicesPage() {
  const { allProducts, categories, suppliers, loadProducts, loadCategories, loadSuppliers } = useProductStore();
  const { toast } = useToast();
  const { user } = useAuth();

  const [customerName, setCustomerName] = useState("");
  const [items, setItems] = useState<InvoiceItemForm[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [taxRate, setTaxRate] = useState(11);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("fixed");
  const [discountValue, setDiscountValue] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>("Tunai");
  const [bankName, setBankName] = useState<(typeof BANK_OPTIONS)[number] | "">("");
  const [keterangan, setKeterangan] = useState("");
  const [signatureName, setSignatureName] = useState("Ari Wibowo");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoice | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);
  const [importFileName, setImportFileName] = useState("");
  const [importIssues, setImportIssues] = useState<ImportIssue[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  useEffect(() => {
    void Promise.all([loadProducts(), loadCategories(), loadSuppliers()]);
  }, [loadCategories, loadProducts, loadSuppliers]);

  const addProductToInvoice = (productId: string) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.productId === productId);
      if (existing) {
        return prev.map((item) =>
          item.productId === productId ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const removeItemByProductId = (productId: string) => {
    setItems((prev) => prev.filter((item) => item.productId !== productId));
  };

  const updateItemQuantity = (productId: string, quantity: number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.productId === productId ? { ...item, quantity: Math.max(Number(quantity) || 1, 1) } : item
      )
    );
  };

  const normalizeImportHeader = (value: unknown) =>
    String(value ?? "").replace(/^\uFEFF/, "").trim().toLowerCase().replace(/[\s_-]+/g, "");

  const getImportErrorMessage = (error: unknown, fallback: string) => {
    if (axios.isAxiosError(error)) {
      return error.response?.data?.error || error.response?.data?.message || fallback;
    }
    return error instanceof Error ? error.message : fallback;
  };

  const downloadImportTemplate = () => {
    const template = "nama produk,sku,pemasok,qty,harga\nContoh Produk,SKU-001,Contoh Pemasok,2,15000\n";
    const url = URL.createObjectURL(new Blob([template], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "template-faktur.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const clearImportedFile = () => {
    setImportFileName("");
    setImportIssues([]);
  };

  const getOrCreateImportCategory = async (categories: Category[], importUserId: string) => {
    const currentUserId = user?.id;
    if (!currentUserId) throw new Error("Sesi pengguna tidak tersedia.");

    const existingCategory = categories[0];
    if (existingCategory) return existingCategory.id;

    const response = await axiosInstance.post("/categories", { name: "Produk Impor", userId: currentUserId });
    if (!response.data?.id) throw new Error("Kategori impor tidak dapat dibuat.");
    return response.data.id as string;
  };

  const getOrCreateSupplier = async (supplierName: string, supplierByName: Map<string, string>, importUserId: string) => {
    const currentUserId = user?.id;
    if (!currentUserId) throw new Error("Sesi pengguna tidak tersedia.");

    const normalizedName = supplierName.toLowerCase();
    const existingSupplierId = supplierByName.get(normalizedName);
    if (existingSupplierId) return existingSupplierId;

    const response = await axiosInstance.post("/suppliers", { name: supplierName, userId: currentUserId });
    if (!response.data?.id) throw new Error("Pemasok tidak dapat dibuat.");
    const supplierId = response.data.id as string;
    supplierByName.set(normalizedName, supplierId);
    return supplierId;
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!user?.id) {
    const importUserId = user?.id;
    if (!importUserId) {
      toast({ title: "Sesi belum siap", description: "Tunggu sesi pengguna dimuat, lalu unggah file kembali.", variant: "destructive" });
      return;
    }

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (!extension || !["csv", "xlsx", "xls"].includes(extension)) {
      toast({ title: "Format file tidak didukung", description: "Unggah file CSV, XLSX, atau XLS.", variant: "destructive" });
      return;
    }

    try {
      setIsImporting(true);
      const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error("EMPTY_FILE");
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
      if (rows.length === 0) throw new Error("EMPTY_FILE");

      const issues: ImportIssue[] = [];
      const importedItems = new Map<string, number>();
      const productsBySku = new Map(allProducts.filter((product) => product.sku).map((product) => [product.sku.trim().toLowerCase(), product]));
      const productsByName = new Map(allProducts.map((product) => [product.name.trim().toLowerCase(), product]));
      const supplierByName = new Map(suppliers.map((supplier) => [supplier.name.trim().toLowerCase(), supplier.id]));
      let categoryId: string | undefined;
      const supplierByName = new Map<string, string>(
        suppliers.map((supplier) => [supplier.name.trim().toLowerCase(), supplier.id])
      );
      let categoryId: string | null = null;
      let createdProductCount = 0;

      for (const [index, row] of rows.entries()) {
        const fields = Object.entries(row).reduce<Record<string, unknown>>((result, [key, value]) => {
          result[normalizeImportHeader(key)] = value;
          return result;
        }, {});
        const name = String(fields.namaproduk ?? fields.namabarang ?? fields.productname ?? fields.product ?? fields.name ?? "").trim();
        const sku = String(fields.sku ?? "").trim();
        const supplierName = String(fields.pemasok ?? fields.supplier ?? "").trim();
        const quantity = Number(fields.qty ?? fields.quantity ?? "");
        const price = Number(fields.harga ?? fields.price ?? "");
        const rowNumber = index + 2;

        if (!name || !sku || !supplierName) {
          issues.push({ row: rowNumber, message: "Nama produk, SKU, dan pemasok wajib diisi." });
          continue;
        }
        if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isInteger(quantity)) {
          issues.push({ row: rowNumber, message: "Qty harus berupa bilangan bulat lebih dari 0." });
          continue;
        }
        if (!Number.isFinite(price) || price < 0) {
          issues.push({ row: rowNumber, message: "Harga harus berupa angka 0 atau lebih." });
          continue;
        }

        const product = productsBySku.get(sku.toLowerCase()) || productsByName.get(name.toLowerCase());
        if (product) {
          importedItems.set(product.id, (importedItems.get(product.id) || 0) + quantity);
          continue;
        }

        try {
          if (!categoryId) {
            categoryId = await getOrCreateImportCategory(categories, importUserId);
          }
          const supplierId = await getOrCreateSupplier(supplierName, supplierByName, importUserId);
          const newProductPayload: Product = {
            id: "",
            createdAt: new Date(),
            userId: importUserId,
            name,
            sku,
            supplierId,
            categoryId,
            quantity,
            price,
            buyPrice: price,
            sellPrice: price,
            hetPrice: price,
            unit: "pcs",
            status: quantity > 20 ? "Tersedia" : "Stok Menipis",
          };
          const response = await axiosInstance.post("/products", newProductPayload);
          const newProduct = response.data as Product;
          if (!newProduct?.id) throw new Error("Produk impor tidak dapat dibuat.");
          productsBySku.set(sku.toLowerCase(), newProduct);
          productsByName.set(name.toLowerCase(), newProduct);
          importedItems.set(newProduct.id, (importedItems.get(newProduct.id) || 0) + quantity);
          createdProductCount += 1;
        } catch (error) {
          issues.push({ row: rowNumber, message: getImportErrorMessage(error, `Produk "${name}" gagal dibuat.`) });
        }
      }

      if (importedItems.size) {
        setItems((currentItems) => {
          const mergedItems = new Map(currentItems.map((item) => [item.productId, item.quantity]));
          importedItems.forEach((quantity, productId) => mergedItems.set(productId, (mergedItems.get(productId) || 0) + quantity));
          return Array.from(mergedItems, ([productId, quantity]) => ({ productId, quantity }));
        });
        await Promise.all([loadProducts(), loadCategories(), loadSuppliers()]);
      }

      setImportFileName(file.name);
      setImportIssues(issues);
      if (importedItems.size) {
        toast({ title: "Produk berhasil diimpor", description: `${importedItems.size} produk ditambahkan ke faktur dari ${file.name}.${createdProductCount ? ` ${createdProductCount} produk baru dibuat.` : ""}${issues.length ? ` ${issues.length} baris perlu diperiksa.` : ""}` });
      } else {
        toast({ title: "Tidak ada produk yang diimpor", description: "Periksa kolom dan data pada file.", variant: "destructive" });
      }
    } catch (error) {
      toast({
        title: "Gagal membaca file",
        description: error instanceof Error && error.message === "EMPTY_FILE"
          ? "File tidak memiliki baris data."
          : getImportErrorMessage(error, "Pastikan file CSV atau Excel tidak rusak dan memiliki header."),
        variant: "destructive",
      });
    } finally {
      setIsImporting(false);
    }
  };

  const filteredProducts = useMemo(() => {
    const query = productSearch.trim().toLowerCase();
    if (!query) return allProducts;
    return allProducts.filter((product) => {
      const name = (product.name || "").toLowerCase();
      const sku = (product.sku || "").toLowerCase();
      const supplier = (product.supplier || "").toLowerCase();
      return name.includes(query) || sku.includes(query) || supplier.includes(query);
    });
  }, [allProducts, productSearch]);

  const estimatedTotal = useMemo(() => {
    return items.reduce((sum, item) => {
      const product = allProducts.find((p) => p.id === item.productId);
      if (!product) return sum;
      return sum + product.price * item.quantity;
    }, 0);
  }, [items, allProducts]);

  const estimatedDiscountAmount = useMemo(() => {
    if (discountType === "percentage") {
      return Math.min(estimatedTotal * (Math.max(discountValue, 0) / 100), estimatedTotal);
    }
    return Math.min(Math.max(discountValue, 0), estimatedTotal);
  }, [discountType, discountValue, estimatedTotal]);
  const estimatedTaxableAmount = useMemo(() => Math.max(estimatedTotal - estimatedDiscountAmount, 0), [estimatedDiscountAmount, estimatedTotal]);
  const estimatedTaxAmount = useMemo(() => estimatedTaxableAmount * (taxRate / 100), [estimatedTaxableAmount, taxRate]);
  const estimatedGrandTotal = useMemo(() => estimatedTaxableAmount + estimatedTaxAmount, [estimatedTaxAmount, estimatedTaxableAmount]);
  const amountPaid = useMemo(() => estimatedGrandTotal, [estimatedGrandTotal]);
  const estimatedChange = 0;
  const getFilteredItems = () => items.filter((item) => item.productId && item.quantity > 0);

  const validateInvoiceInput = () => {
    const filteredItems = getFilteredItems();

    if (filteredItems.length === 0) {
      toast({ title: "No invoice items", description: "Add at least one valid product line.", variant: "destructive" });
      return false;
    }

    if ((paymentMethod === "Bank Transfer" || paymentMethod === "Kartu Debit/Kredit") && !bankName) {
      toast({
        title: "Bank required",
        description: "Please select a bank for bank transfer or card payment.",
        variant: "destructive",
      });
      return false;
    }

    return true;
  };


  const openInvoicePdf = (invoice: CreatedInvoice) => {
    const didOpen = openAndPrintTypewriterReport({
      documentTitle: `Faktur-${invoice.invoiceNumber}`,
      reportHeading: `Faktur ${invoice.invoiceNumber}`,
      reportSubheading: `Pelanggan: ${invoice.customerName}`,
      generatedAt: new Date().toLocaleString("id-ID"),
      tableHeaders: ["Produk", "SKU", "Pemasok", "Qty", "Harga", "Total"],
      tableRows: invoice.items.map((item) => [
        item.name,
        item.sku,
        item.supplier,
        String(item.quantity),
        formatCurrency(item.price),
        formatCurrency(item.lineTotal),
      ]),
      summaryLines: [
        `Diinput oleh: ${invoice.createdByName || "Unknown User"}`,
        `Metode pembayaran: ${invoice.paymentMethod}`,
        `Keterangan: ${invoice.keterangan || "-"}`,
        `Subtotal: ${formatCurrency(invoice.totalAmount)}`,
        `Diskon: ${formatCurrency(invoice.discountAmount || 0)}`,
        `Pajak: ${formatCurrency(invoice.taxAmount)}`,
        `Total akhir: ${formatCurrency(invoice.grandTotal)}`,
      ],
      signatureName: invoice.signatureName || "Ari Wibowo",
    });

    if (!didOpen) {
      toast({
        title: "Gagal membuka PDF",
        description: "Izinkan pop-up browser lalu coba lagi.",
        variant: "destructive",
      });
    }
  };

  const createInvoice = async () => {
    const filteredItems = getFilteredItems();

    try {
      setIsSubmitting(true);

      const response = await axiosInstance.post("/invoices", {
        customerName,
        items: filteredItems,
        taxRate,
        discountType,
        discountValue,
        promoCode,
        amountPaid,
        paymentMethod,
        bankName,
        keterangan,
        signatureName,
      });

      setCreatedInvoice(response.data);
      setItems([]);
      setProductSearch("");
      setCustomerName("");
      setTaxRate(11);
      setDiscountType("fixed");
      setDiscountValue(0);
      setPromoCode("");
      setPaymentMethod("Tunai");
      setBankName("");
      setKeterangan("");
      setSignatureName("Ari Wibowo");
      setIsFinished(false);
      await loadProducts();

      toast({
        title: "Invoice created",
        description: `Invoice ${response.data.invoiceNumber} was created and stock has been updated.`,
      });

      openInvoicePdf(response.data);
    } catch (error: any) {
      toast({
        title: "Failed to create invoice",
        description: error?.response?.data?.error || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setIsConfirmDialogOpen(false);
    }
  };

  const handleCreateInvoiceClick = () => {
    if (!validateInvoiceInput()) return;
    setIsConfirmDialogOpen(true);
  };

  const handlePrintInvoice = () => {
    if (!createdInvoice) return;
    openInvoicePdf(createdInvoice);
  };

  const finishInvoice = () => {
    setIsFinished(true);
    toast({
      title: "Invoice finished",
      description: "Invoice has already been stored in database and marked as completed.",
    });
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 p-4 lg:p-0">
        <Card className="print:hidden">
          <CardContent className="py-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium">Butuh ringkasan operasional cepat?</p>
              <p className="text-xs text-muted-foreground">Gunakan halaman data untuk memantau pergerakan faktur dan perilaku pembelian.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/invoices/data">
                <Button variant="outline">Data Faktur</Button>
              </Link>
              <Link href="/invoices/purchasing">
                <Button>Tinjauan Pembelian <ArrowRight className="h-4 w-4 ml-1" /></Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Buat Faktur</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Nama Pelanggan</Label>
              <Input
                id="customerName"
                placeholder="Pelanggan Umum"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

        <div className="space-y-2">
                      <Label>Metode Pembayaran</Label>
                      <div className="flex flex-wrap gap-2">
                        {PAYMENT_METHODS.map((method) => (
                          <Button
                            key={method}
                            type="button"
                            variant={paymentMethod === method ? "default" : "outline"}
                            onClick={() => {
                              setPaymentMethod(method);
                              if (method !== "Bank Transfer" && method !== "Kartu Debit/Kredit") {
                                setBankName("");
                              }
                            }}
                          >
                            {method}
                          </Button>
                        ))}
                      </div>
                  </div>

            {(paymentMethod === "Bank Transfer" || paymentMethod === "Kartu Debit/Kredit") && (
              <div className="space-y-2">
                <Label htmlFor="bankName">Bank</Label>
                <select
                  id="bankName"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value as (typeof BANK_OPTIONS)[number])}
                  className="w-full h-10 rounded-md border bg-background px-3"
                >
                  <option value="">Select bank</option>
                  {BANK_OPTIONS.map((bank) => (
                    <option key={bank} value={bank}>
                      {bank}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div className="space-y-3 rounded-lg border border-dashed p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex gap-3">
                  <div className="rounded-md bg-muted p-2">
                    <FileSpreadsheet className="h-5 w-5" />
                  </div>
                  <div>
                    <Label htmlFor="invoice-import" className="text-base">Impor item faktur</Label>
                    <p className="text-sm text-muted-foreground">Unggah CSV untuk file kecil atau Excel (.xlsx/.xls). Produk yang belum ada akan dibuat otomatis.</p>
                  </div>
                </div>
                <Button type="button" variant="link" className="h-auto p-0" onClick={downloadImportTemplate}>
                  Unduh template CSV
                </Button>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Input
                  id="invoice-import"
                  type="file"
                  accept=".csv,.xlsx,.xls,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  className="max-w-md cursor-pointer"
                  onChange={handleImportFile}
                  disabled={isImporting}
                />
                {isImporting && <span className="text-sm text-muted-foreground">Membaca file…</span>}
                {importFileName && !isImporting && (
                  <Button type="button" variant="ghost" size="sm" onClick={clearImportedFile}>
                    <X className="mr-1 h-4 w-4" /> Hapus status file
                  </Button>
                )}
              </div>
              <p className="text-xs text-muted-foreground">Kolom wajib: <span className="font-medium">nama produk</span>, <span className="font-medium">sku</span>, <span className="font-medium">pemasok</span>, <span className="font-medium">qty</span>, dan <span className="font-medium">harga</span>. Harga produk baru dipakai sebagai harga beli, harga jual, dan HET.</p>
              {importFileName && <p className="text-sm font-medium">File terakhir: {importFileName}</p>}
              {importIssues.length > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100">
                  <p className="font-medium">{importIssues.length} baris tidak diimpor</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5">
                    {importIssues.slice(0, 5).map((issue) => <li key={`${issue.row}-${issue.message}`}>Baris {issue.row}: {issue.message}</li>)}
                    {importIssues.length > 5 && <li>Dan {importIssues.length - 5} baris lainnya.</li>}
                  </ul>
                </div>
              )}
            </div>
            <div className="space-y-3">
              <Label>Add Product</Label>
              <Dialog open={isProductSelectorOpen} onOpenChange={setIsProductSelectorOpen}>
                <DialogTrigger asChild>
                  <Button type="button" variant="outline">
                    <PlusCircle className="h-4 w-4 mr-2" />
                    Open Product Selector
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-5xl">
                  <DialogHeader>
                  <DialogTitle>Pilih Produk</DialogTitle>
                    <DialogDescription>
                      Cari dan pilih produk dari tabel, lalu tambahkan item satu per satu ke faktur.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <Input
                      id="productSearch"
                      placeholder="Search by name, SKU, supplier..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                    />
                    <div className="max-h-[420px] overflow-y-auto rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Product</TableHead>
                            <TableHead>SKU</TableHead>
                            <TableHead>Supplier</TableHead>
                            <TableHead>Stock</TableHead>
                            <TableHead>Price</TableHead>
                            <TableHead className="text-right">Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredProducts.map((product) => {
                            const alreadyAdded = items.some((item) => item.productId === product.id);
                            return (
                              <TableRow key={product.id}>
                                <TableCell className="font-medium">{product.name}</TableCell>
                                <TableCell>{product.sku || "-"}</TableCell>
                                <TableCell>{product.supplier || "Unknown"}</TableCell>
                                <TableCell>{product.quantity}</TableCell>
                                <TableCell>{formatCurrency(product.price)}</TableCell>
                                <TableCell className="text-right">
                                  <Button type="button" size="sm" onClick={() => addProductToInvoice(product.id)}>
                                    {alreadyAdded ? "Add +1" : "Add"}
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                    {!filteredProducts.length && <p className="text-sm text-muted-foreground">No products found in database for this search.</p>}
                  </div>
                  <DialogFooter>
                    <DialogClose asChild>
                      <Button type="button" variant="outline">Close</Button>
                    </DialogClose>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
              {!!allProducts.length && <p className="text-xs text-muted-foreground">Available products: {allProducts.length}</p>}
              {!allProducts.length && <p className="text-xs text-muted-foreground">No products loaded yet. Please check product data/API.</p>}
            </div>

            <div className="space-y-3">
              <Label>Selected Items</Label>
              {items.length === 0 ? (
                <p className="text-sm text-muted-foreground">No items selected yet. Open Product Selector to add items.</p>
              ) : (
                <div className="space-y-2">
                  {items.map((item) => {
                    const selectedProduct = allProducts.find((product) => product.id === item.productId);
                    if (!selectedProduct) return null;

                    return (
                      <div key={item.productId} className="grid grid-cols-12 gap-2 items-end rounded-md border p-2">
                        <div className="col-span-7">
                          <p className="font-medium">{selectedProduct.name}</p>
                          <p className="text-xs text-muted-foreground">{selectedProduct.sku} • Stock: {selectedProduct.quantity}</p>
                        </div>
                        <div className="col-span-3">
                          <div className="flex items-center gap-2">
                            <Label className="whitespace-nowrap">Qty</Label>
                            <Input
                              type="number"
                              min={1}
                              max={selectedProduct.quantity || 1}
                              value={item.quantity}
                              onChange={(e) => updateItemQuantity(item.productId, Number(e.target.value))}
                            />
                          </div>
                        </div>
                        <div className="col-span-2">
                          <Button
                            type="button"
                            variant="ghost"
                            className="w-full"
                            onClick={() => removeItemByProductId(item.productId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <p className="text-sm text-muted-foreground">Subtotal: {formatCurrency(estimatedTotal)}</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="discountType">Discount Type</Label>
                <select
                  id="discountType"
                  value={discountType}
                  onChange={(e) => setDiscountType(e.target.value as "percentage" | "fixed")}
                  className="w-full h-10 rounded-md border bg-background px-3"
                >
                  <option value="fixed">Fixed (IDR)</option>
                  <option value="percentage">Percentage (%)</option>
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountValue">Discount Value</Label>
                <Input
                  id="discountValue"
                  type="number"
                  min={0}
                  value={discountValue}
                  onChange={(e) => setDiscountValue(Math.max(Number(e.target.value) || 0, 0))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="promoCode">Promo Code</Label>
                <Input
                  id="promoCode"
                  placeholder="PROMO10"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3">
              <div className="space-y-2">
                <Label htmlFor="taxRate">Tax Information (%)</Label>
                <Input
                  id="taxRate"
                  type="number"
                  min={0}
                  value={taxRate}
                  onChange={(e) => setTaxRate(Math.max(Number(e.target.value) || 0, 0))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keterangan">Payment Information (Keterangan)</Label>
              <textarea
                id="keterangan"
                className="w-full min-h-24 rounded-md border bg-background px-3 py-2"
                placeholder="Contoh: Bayar tunai pecahan 100rb"
                value={keterangan}
                onChange={(e) => setKeterangan(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="signatureName">Nama Penanda Tangan (untuk tanda tangan PDF)</Label>
              <Input
                id="signatureName"
                placeholder="Ari Wibowo"
                value={signatureName}
                onChange={(e) => setSignatureName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Nama ini akan muncul di bagian tanda tangan pada hasil Print / Save PDF.</p>
            </div>
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p>Subtotal: {formatCurrency(estimatedTotal)}</p>
              <p>Discount: -{formatCurrency(estimatedDiscountAmount)}</p>
              <p>Taxable Amount: {formatCurrency(estimatedTaxableAmount)}</p>
              <p>Tax Amount: {formatCurrency(estimatedTaxAmount)}</p>
              <p className="font-medium">Grand Total: {formatCurrency(estimatedGrandTotal)}</p>
              <p>Return/Change: {formatCurrency(estimatedChange)}</p>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={handleCreateInvoiceClick} disabled={isSubmitting}>
                {isSubmitting ? "Membuat..." : "Buat Faktur"}
              </Button>
            </div>  
          </CardContent>
        </Card>

        <Dialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Konfirmasi Invoice</DialogTitle>
              <DialogDescription>Pastikan data sudah benar sebelum membuat invoice.</DialogDescription>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p><span className="font-medium">Pelanggan:</span> {customerName || "Pelanggan Umum"}</p>
              <p><span className="font-medium">Pembayaran:</span> {paymentMethod} {bankName ? `- ${bankName}` : ""}</p>
              <p><span className="font-medium">Penanda Tangan:</span> {signatureName || "Ari Wibowo"}</p>
              <div className="rounded-md border p-3 space-y-1">
                <p>Subtotal: {formatCurrency(estimatedTotal)}</p>
                <p>Discount: -{formatCurrency(estimatedDiscountAmount)}</p>
                <p>Tax ({taxRate}%): {formatCurrency(estimatedTaxAmount)}</p>
                <p className="font-semibold">Grand Total: {formatCurrency(estimatedGrandTotal)}</p>
                <p>Amount Paid: {formatCurrency(amountPaid)}</p>
                <p>Change: {formatCurrency(estimatedChange)}</p>
              </div>
              <div className="max-h-56 overflow-y-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="px-2 py-2">Product</th>
                      <th className="px-2 py-2">Qty</th>
                      <th className="px-2 py-2 text-right">Line Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {getFilteredItems().map((item) => {
                      const product = allProducts.find((p) => p.id === item.productId);
                      if (!product) return null;
                      return (
                        <tr key={`confirm-${item.productId}`} className="border-b">
                          <td className="px-2 py-2">{product.name}</td>
                          <td className="px-2 py-2">{item.quantity}</td>
                          <td className="px-2 py-2 text-right">{formatCurrency(product.price * item.quantity)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsConfirmDialogOpen(false)}>
                Batal
              </Button>
              <Button type="button" onClick={createInvoice} disabled={isSubmitting}>
                {isSubmitting ? "Membuat..." : "Ya, Buat Invoice"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>


        {createdInvoice && (
          <Card className="print:font-mono invoice-print-compact">
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Faktur {createdInvoice.invoiceNumber}</CardTitle>
                <p className="text-sm text-muted-foreground">
                  {createdInvoice.customerName} • {new Date(createdInvoice.createdAt).toLocaleString()}
                </p>
                <p className="text-sm text-emerald-600">
                  This invoice is already saved in the database. Printing will not remove it.
                </p>
              </div>
              <div className="flex gap-2 print:hidden">
                <Button type="button" variant="outline" onClick={handlePrintInvoice}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print / Save PDF
                </Button>
                <Button type="button" onClick={finishInvoice} disabled={isFinished}>
                  {isFinished ? "Invoice Finished" : "Finish Invoice"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Image
                  src="/pdf-header-template.svg"
                  alt="Header Koperasi"
                  width={2048}
                  height={357}
                  className="w-full h-auto"
                  priority
                />
              </div>

              <h3 className="text-xl font-bold mb-3 text-center">Rincian Transaksi Penjualan</h3>
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b text-left">
                    <th className="py-2">Product</th>
                    <th className="py-2">SKU</th>
                    <th className="py-2">Supplier</th>
                    <th className="py-2">Qty</th>
                    <th className="py-2">Price</th>
                    <th className="py-2 text-right">Line Total</th>
                  </tr>
                </thead>
                <tbody>
                  {createdInvoice.items.map((item) => (
                    <tr key={`${item.productId}-${item.sku}`} className="border-b">
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

              <div className="mt-4 text-right space-y-1">
                <p>Payment Method: {createdInvoice.paymentMethod}</p>
                <p>Bank: {createdInvoice.bankName || "-"}</p>
                <p>Subtotal: {formatCurrency(createdInvoice.totalAmount)}</p>
                <p>Promo Code: {createdInvoice.promoCode || "-"}</p>
                <p>Discount ({createdInvoice.discountType === "percentage" ? `${createdInvoice.discountValue}%` : formatCurrency(createdInvoice.discountValue)}): -{formatCurrency(createdInvoice.discountAmount)}</p>
                <p>Tax ({createdInvoice.taxRate}%): {formatCurrency(createdInvoice.taxAmount)}</p>
                <p className="font-semibold text-lg">Grand Total: {formatCurrency(createdInvoice.grandTotal)}</p>
                <p>Amount Paid: {formatCurrency(createdInvoice.amountPaid)}</p>
                <p>Return/Change: {formatCurrency(createdInvoice.changeAmount)}</p>
                <p>Keterangan: {createdInvoice.keterangan || "-"}</p>
              </div>

              <div className="mt-10 flex justify-end">
                <div className="text-center min-w-56">
                  <p>{new Date(createdInvoice.createdAt).toLocaleDateString("id-ID")}</p>
                  <p className="mb-16">Mengetahui,</p>
                  <p className="font-semibold underline">{createdInvoice.signatureName || "Ari Wibowo"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
}