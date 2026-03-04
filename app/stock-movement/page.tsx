"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { useProductStore } from "@/app/useProductStore";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import { useEffect, useMemo, useState } from "react";

interface StockMovement {
  id: string;
  date: string;
  movementType: "IN" | "OUT";
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  invoiceReference: string;
  productName: string;
  category: string;
  supplier: string;
  unit: string;
  createdByName?: string;
}

interface MovementResponse {
  movements: StockMovement[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasPrev: boolean;
    hasNext: boolean;
    search: string;
  };
}

const formatQty = (movement: StockMovement) => `${movement.movementType === "IN" ? "+" : "-"}${movement.quantity}`;

export default function StockMovementPage() {
  const { toast } = useToast();
  const { allProducts, loadProducts } = useProductStore();

  const [data, setData] = useState<MovementResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [productId, setProductId] = useState("");
  const [movementType, setMovementType] = useState<"IN" | "OUT">("IN");
  const [quantity, setQuantity] = useState(1);
  const [invoiceReference, setInvoiceReference] = useState("");
  const [notes, setNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    loadProducts();
  }, [loadProducts]);

  useEffect(() => {
    const loadMovement = async () => {
      try {
        setIsLoading(true);
        const response = await axiosInstance.get("/stock-movements", { params: { limit: 10, page, search } });
        setData(response.data);
      } catch (error: any) {
        toast({
          title: "Failed to load stock movement",
          description: error?.response?.data?.error || "Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadMovement();
  }, [page, search, toast]);

  const selectedProduct = useMemo(() => allProducts.find((product) => product.id === productId), [allProducts, productId]);

  const submitMovement = async () => {
    if (!productId) {
      toast({ title: "Product required", description: "Please select product first.", variant: "destructive" });
      return;
    }

    if (quantity <= 0) {
      toast({ title: "Invalid quantity", description: "Quantity should be greater than 0.", variant: "destructive" });
      return;
    }

    try {
      setIsSubmitting(true);
      await axiosInstance.post("/stock-movements", {
        productId,
        movementType,
        quantity,
        invoiceReference,
        notes,
      });

      toast({ title: "Stock movement recorded", description: "Movement has been saved and stock updated." });
      setQuantity(1);
      setInvoiceReference("");
      setNotes("");
      await loadProducts();
      const response = await axiosInstance.get("/stock-movements", { params: { limit: 10, page: 1, search } });
      setData(response.data);
      setPage(1);
    } catch (error: any) {
      toast({
        title: "Failed to save movement",
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
        <Card>
          <CardHeader>
            <CardTitle>Laporan Detail Pergerakan Stock</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            <div className="space-y-2">
              <Label>Nama Product</Label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full h-10 rounded-md border bg-background px-3"
              >
                <option value="">Pilih Product</option>
                {allProducts.map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.name} ({product.sku}) - Stock {product.quantity}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label>Jenis Pergerakan</Label>
              <select
                value={movementType}
                onChange={(e) => setMovementType(e.target.value as "IN" | "OUT")}
                className="w-full h-10 rounded-md border bg-background px-3"
              >
                <option value="IN">IN</option>
                <option value="OUT">OUT</option>
              </select>
            </div>
            <div className="space-y-2">
              <Label>Kuantitas</Label>
              <Input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Math.max(Number(e.target.value) || 0, 0))} />
            </div>
            <div className="space-y-2">
              <Label>Refrensi Invoices</Label>
              <Input value={invoiceReference} onChange={(e) => setInvoiceReference(e.target.value)} placeholder="INV-20260101-ABC123" />
            </div>
            <div className="space-y-2 lg:col-span-2">
              <Label>Catatan</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Contoh: barang retur / stok opname" />
            </div>
            <div className="flex items-end">
              <Button type="button" onClick={submitMovement} disabled={isSubmitting}>
                {isSubmitting ? "Menyimpan..." : "Record Pergerakan"}
              </Button>
            </div>
            {selectedProduct && (
              <p className="text-xs text-muted-foreground md:col-span-3">
                Product dipilih: <span className="font-medium">{selectedProduct.name}</span> • Kategori: {selectedProduct.category || "Unknown"} • Supplier: {selectedProduct.supplier || "Unknown"} • Satuan: {selectedProduct.unit || "pcs"}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Riwayat Pergerakan Stock</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Cari product / invoice / supplier / kategori..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading data pergerakan...</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Jenis Pergerakan</TableHead>
                      <TableHead>Kuantitas (in-out)</TableHead>
                      <TableHead>Stok Saat Keluar</TableHead>
                      <TableHead>Refrensi Invoices</TableHead>
                      <TableHead>Nama Product</TableHead>
                      <TableHead>Kategori</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Satuan</TableHead>
                      <TableHead>Input By</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.movements.map((movement) => (
                      <TableRow key={movement.id}>
                        <TableCell>{new Date(movement.date).toLocaleString("id-ID")}</TableCell>
                        <TableCell>{movement.movementType}</TableCell>
                        <TableCell>{formatQty(movement)}</TableCell>
                        <TableCell>{movement.stockBefore}</TableCell>
                        <TableCell>{movement.invoiceReference || "-"}</TableCell>
                        <TableCell>{movement.productName}</TableCell>
                        <TableCell>{movement.category}</TableCell>
                        <TableCell>{movement.supplier}</TableCell>
                        <TableCell>{movement.unit}</TableCell>
                        <TableCell>{movement.createdByName || "admin"}</TableCell>
                      </TableRow>
                    ))}
                    {!data?.movements.length && (
                      <TableRow>
                        <TableCell colSpan={10} className="text-center text-muted-foreground">
                          Belum ada data pergerakan stock.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>

                <div className="flex items-center justify-between">
                  <p className="text-sm text-muted-foreground">
                    Page {data?.pagination.page || 1} of {data?.pagination.totalPages || 1}
                  </p>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" disabled={!data?.pagination.hasPrev} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
                      Previous
                    </Button>
                    <Button type="button" variant="outline" disabled={!data?.pagination.hasNext} onClick={() => setPage((prev) => prev + 1)}>
                      Next
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </AuthenticatedLayout>
  );
}
