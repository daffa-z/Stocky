"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { useProductStore } from "@/app/useProductStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import { ArrowRight, PlusCircle, Printer, Trash2 } from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import Link from "next/link";
import Image from "next/image";
import React, { useEffect, useMemo, useState } from "react";

interface InvoiceItemForm {
  productId: string;
  quantity: number;
}

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

export default function InvoicesPage() {
  const { allProducts, loadProducts } = useProductStore();
  const { toast } = useToast();

  const [customerName, setCustomerName] = useState("");
  const [items, setItems] = useState<InvoiceItemForm[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [taxRate, setTaxRate] = useState(11);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("fixed");
  const [discountValue, setDiscountValue] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>("Tunai");
  const [bankName, setBankName] = useState<(typeof BANK_OPTIONS)[number] | "">("");
  const [keterangan, setKeterangan] = useState("");
  const [signatureName, setSignatureName] = useState("Koperasi");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoice | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const [isProductSelectorOpen, setIsProductSelectorOpen] = useState(false);
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

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
  const estimatedChange = useMemo(() => Math.max(amountPaid - estimatedGrandTotal, 0), [amountPaid, estimatedGrandTotal]);
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

    if (amountPaid < estimatedGrandTotal) {
      toast({
        title: "Insufficient payment",
        description: "Amount paid must be greater than or equal to grand total.",
        variant: "destructive",
      });
      return false;
    }

    return true;
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
      setAmountPaid(0);
      setPaymentMethod("Tunai");
      setBankName("");
      setKeterangan("");
      setSignatureName("Koperasi");
      setIsFinished(false);
      await loadProducts();

      toast({
        title: "Invoice created",
        description: `Invoice ${response.data.invoiceNumber} was created and stock has been updated.`,
      });
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
    if (!createdInvoice) {
      window.print();
      return;
    }

    const originalTitle = document.title;
    document.title = createdInvoice.invoiceNumber;
    window.print();
    document.title = originalTitle;
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
              <p className="text-sm font-medium">Need a quick operational review?</p>
              <p className="text-xs text-muted-foreground">Use the data pages to track invoice movement and purchasing behavior.</p>
            </div>
            <div className="flex gap-2">
              <Link href="/invoices/data">
                <Button variant="outline">Invoice Data</Button>
              </Link>
              <Link href="/invoices/purchasing">
                <Button>Purchasing Review <ArrowRight className="h-4 w-4 ml-1" /></Button>
              </Link>
            </div>
          </CardContent>
        </Card>
        <Card className="print:hidden">
          <CardHeader>
            <CardTitle>Create Invoice</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="customerName">Customer Name</Label>
              <Input
                id="customerName"
                placeholder="Walk-in Customer"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>

        <div className="space-y-2">
                      <Label>Payment Method</Label>
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
                    <DialogTitle>Select Product</DialogTitle>
                    <DialogDescription>
                      Search and pick product from table, then add each item one by one to invoice.
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
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
              <div className="space-y-2">
                <Label htmlFor="amountPaid">Amount Paid</Label>
                <Input
                  id="amountPaid"
                  type="number"
                  min={0}
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(Math.max(Number(e.target.value) || 0, 0))}
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
                placeholder="Koperasi"
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
                {isSubmitting ? "Creating..." : "Create Invoice"}
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
              <p><span className="font-medium">Customer:</span> {customerName || "Walk-in Customer"}</p>
              <p><span className="font-medium">Payment:</span> {paymentMethod} {bankName ? `- ${bankName}` : ""}</p>
              <p><span className="font-medium">Penanda Tangan:</span> {signatureName || "Koperasi"}</p>
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
                <CardTitle>Invoice {createdInvoice.invoiceNumber}</CardTitle>
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
                  <p className="font-semibold underline">{createdInvoice.signatureName || "Koperasi"}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AuthenticatedLayout>
  );
}
