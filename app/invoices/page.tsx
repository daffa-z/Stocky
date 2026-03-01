"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { useProductStore } from "@/app/useProductStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import { ArrowRight, MinusCircle, PlusCircle, Printer } from "lucide-react";
import Link from "next/link";
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
  keterangan: string;
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

const PAYMENT_METHODS = ["Tunai", "Bank Transfer", "E-Wallet", "QRIS"] as const;

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
  const [items, setItems] = useState<InvoiceItemForm[]>([{ productId: "", quantity: 1 }]);
  const [taxRate, setTaxRate] = useState(11);
  const [discountType, setDiscountType] = useState<"percentage" | "fixed">("fixed");
  const [discountValue, setDiscountValue] = useState(0);
  const [promoCode, setPromoCode] = useState("");
  const [amountPaid, setAmountPaid] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<(typeof PAYMENT_METHODS)[number]>("Tunai");
  const [keterangan, setKeterangan] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoice | null>(null);
  const [isFinished, setIsFinished] = useState(false);
  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  const addItem = () => {
    setItems((prev) => [...prev, { productId: "", quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, changes: Partial<InvoiceItemForm>) => {
    setItems((prev) => prev.map((item, i) => (i === index ? { ...item, ...changes } : item)));
  };

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
  const createInvoice = async () => {
    const filteredItems = items.filter((item) => item.productId && item.quantity > 0);

    if (filteredItems.length === 0) {
      toast({ title: "No invoice items", description: "Add at least one valid product line.", variant: "destructive" });
      return;
    }

    if (amountPaid < estimatedGrandTotal) {
      toast({
        title: "Insufficient payment",
        description: "Amount paid must be greater than or equal to grand total.",
        variant: "destructive",
      });
      return;
    }


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
        keterangan,
      });

      setCreatedInvoice(response.data);
      setItems([{ productId: "", quantity: 1 }]);
      setCustomerName("");
      setTaxRate(11);
      setDiscountType("fixed");
      setDiscountValue(0);
      setPromoCode("");
      setAmountPaid(0);
      setPaymentMethod("Tunai");
      setKeterangan("");
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
    }
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
                            onClick={() => setPaymentMethod(method)}
                          >
                            {method}
                          </Button>
                        ))}
                      </div>
                  </div>
            <div className="space-y-3">
              {items.map((item, index) => {
                const selectedProduct = allProducts.find((product) => product.id === item.productId);
                return (
                  <div key={`invoice-item-${index}`} className="grid grid-cols-12 gap-2 items-end">
                    <div className="col-span-7">
                      <Label>Product</Label>
                      <select
                        value={item.productId}
                        onChange={(e) => updateItem(index, { productId: e.target.value })}
                        className="w-full h-10 rounded-md border bg-background px-3"
                      >
                        <option value="">Select product</option>
                        {allProducts.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name} ({product.sku}) • Supplier: {product.supplier || "Unknown"} - Stock: {product.quantity}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="col-span-3">
                      <Label>Qty</Label>
                      <Input
                        type="number"
                        min={1}
                        max={selectedProduct?.quantity || 1}
                        value={item.quantity}
                        onChange={(e) => updateItem(index, { quantity: Number(e.target.value) })}
                      />
                    </div>

                    <div className="col-span-2">
                      <Button
                        type="button"
                        variant="ghost"
                        className="w-full"
                        onClick={() => removeItem(index)}
                        disabled={items.length === 1}
                      >
                        <MinusCircle className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Button type="button" variant="outline" onClick={addItem}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Item
              </Button>
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
            <div className="rounded-md border p-3 text-sm space-y-1">
              <p>Subtotal: {formatCurrency(estimatedTotal)}</p>
              <p>Discount: -{formatCurrency(estimatedDiscountAmount)}</p>
              <p>Taxable Amount: {formatCurrency(estimatedTaxableAmount)}</p>
              <p>Tax Amount: {formatCurrency(estimatedTaxAmount)}</p>
              <p className="font-medium">Grand Total: {formatCurrency(estimatedGrandTotal)}</p>
              <p>Return/Change: {formatCurrency(estimatedChange)}</p>
            </div>
            <div className="flex justify-end">
              <Button type="button" onClick={createInvoice} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Invoice"}
              </Button>
            </div>  
          </CardContent>
        </Card>

        {createdInvoice && (
          <Card>
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
                <Button type="button" variant="outline" onClick={() => window.print()}>
                  <Printer className="h-4 w-4 mr-2" />
                  Print / Save PDF
                </Button>
                <Button type="button" onClick={finishInvoice} disabled={isFinished}>
                  {isFinished ? "Invoice Finished" : "Finish Invoice"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
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
                <p>Subtotal: {formatCurrency(createdInvoice.totalAmount)}</p>
                <p>Promo Code: {createdInvoice.promoCode || "-"}</p>
                <p>Discount ({createdInvoice.discountType === "percentage" ? `${createdInvoice.discountValue}%` : formatCurrency(createdInvoice.discountValue)}): -{formatCurrency(createdInvoice.discountAmount)}</p>
                <p>Tax ({createdInvoice.taxRate}%): {formatCurrency(createdInvoice.taxAmount)}</p>
                <p className="font-semibold text-lg">Grand Total: {formatCurrency(createdInvoice.grandTotal)}</p>
                <p>Amount Paid: {formatCurrency(createdInvoice.amountPaid)}</p>
                <p>Return/Change: {formatCurrency(createdInvoice.changeAmount)}</p>
                <p>Keterangan: {createdInvoice.keterangan || "-"}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AuthenticatedLayout>
  );
}