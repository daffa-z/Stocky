"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { useProductStore } from "@/app/useProductStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import { MinusCircle, PlusCircle, Printer } from "lucide-react";
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

export default function InvoicesPage() {
  const { allProducts, loadProducts } = useProductStore();
  const { toast } = useToast();

  const [customerName, setCustomerName] = useState("");
  const [items, setItems] = useState<InvoiceItemForm[]>([{ productId: "", quantity: 1 }]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdInvoice, setCreatedInvoice] = useState<CreatedInvoice | null>(null);

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

  const createInvoice = async () => {
    const filteredItems = items.filter((item) => item.productId && item.quantity > 0);

    if (filteredItems.length === 0) {
      toast({ title: "No invoice items", description: "Add at least one valid product line.", variant: "destructive" });
      return;
    }

    try {
      setIsSubmitting(true);

      const response = await axiosInstance.post("/invoices", {
        customerName,
        items: filteredItems,
      });

      setCreatedInvoice(response.data);
      setItems([{ productId: "", quantity: 1 }]);
      setCustomerName("");
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

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 p-4 lg:p-0">
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
              <Button type="button" onClick={createInvoice} disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create Invoice"}
              </Button>
              <p className="text-sm text-muted-foreground">Estimated Total: ${estimatedTotal.toFixed(2)}</p>
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
              </div>
              <Button type="button" variant="outline" className="print:hidden" onClick={() => window.print()}>
                <Printer className="h-4 w-4 mr-2" />
                Print / Save PDF
              </Button>
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
                      <td className="py-2">${item.price.toFixed(2)}</td>
                      <td className="py-2 text-right">${item.lineTotal.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="mt-4 text-right font-semibold text-lg">
                Total: ${createdInvoice.totalAmount.toFixed(2)}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AuthenticatedLayout>
  );
}