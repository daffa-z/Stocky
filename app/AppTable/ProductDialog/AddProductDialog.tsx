/* eslint-disable @typescript-eslint/no-unused-vars */
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { useForm, FormProvider } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useProductStore } from "@/app/useProductStore";
import { useToast } from "@/hooks/use-toast";
import ProductName from "./_components/ProductName";
import SKU from "./_components/SKU";
import Quantity from "./_components/Quantity";
import Price from "./_components/Price";
import Unit from "./_components/Unit";
import { Product } from "@/app/types";

const ProductSchema = z.object({
  productName: z
    .string()
    .min(1, "Nama barang wajib diisi")
    .max(100, "Nama barang maksimal 100 karakter"),
  sku: z
    .string()
    .min(1, "SKU wajib diisi")
    .regex(/^[a-zA-Z0-9-_]+$/, "SKU harus berupa huruf/angka"),
  quantity: z
    .number()
    .int("Stok harus berupa bilangan bulat")
    .nonnegative("Stok tidak boleh negatif"),
  unit: z.string().min(1, "Satuan wajib diisi"),
  buyPrice: z.number().nonnegative("Harga beli tidak boleh negatif"),
  sellPrice: z.number().nonnegative("Harga jual tidak boleh negatif"),
  hetPrice: z.number().nonnegative("HET tidak boleh negatif"),
  minimumMarginPercent: z.number().min(0, "Margin minimum tidak boleh negatif"),
});

interface ProductFormData {
  productName: string;
  sku: string;
  quantity: number;
  unit: string;
  buyPrice: number;
  sellPrice: number;
  hetPrice: number;
  minimumMarginPercent: number;
}

interface AddProductDialogProps {
  allProducts: Product[];
  userId: string;
}

export default function AddProductDialog({
  allProducts,
  userId,
}: AddProductDialogProps) {
  const methods = useForm<ProductFormData>({
    resolver: zodResolver(ProductSchema),
    defaultValues: {
      productName: "",
      sku: "",
      quantity: 0,
      unit: "pcs",
      buyPrice: 0,
      sellPrice: 0,
      hetPrice: 0,
      minimumMarginPercent: 10,
    },
  });

  const { reset, watch, setValue } = methods;

  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [selectedSupplier, setSelectedSupplier] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false); // Button loading state
  const dialogCloseRef = useRef<HTMLButtonElement | null>(null);

  const {
    isLoading,
    setOpenProductDialog,
    openProductDialog,
    setSelectedProduct,
    selectedProduct,
    addProduct,
    updateProduct,
    loadProducts,
    categories,
    suppliers,
  } = useProductStore();
  const { toast } = useToast();

  useEffect(() => {
    if (selectedProduct) {
      reset({
        productName: selectedProduct.name,
        sku: selectedProduct.sku,
        quantity: selectedProduct.quantity,
        unit: selectedProduct.unit || "pcs",
        buyPrice: selectedProduct.buyPrice ?? selectedProduct.price,
        sellPrice: selectedProduct.sellPrice ?? selectedProduct.price,
        hetPrice: selectedProduct.hetPrice ?? selectedProduct.sellPrice ?? selectedProduct.price,
        minimumMarginPercent: selectedProduct.minimumMarginPercent ?? 10,
      });
      setSelectedCategory(selectedProduct.categoryId || "");
      setSelectedSupplier(selectedProduct.supplierId || "");
    } else {
      // Reset form to default values for adding a new product
      reset({
        productName: "",
        sku: "",
        quantity: 0,
        unit: "pcs",
        buyPrice: 0,
        sellPrice: 0,
        hetPrice: 0,
        minimumMarginPercent: 10,
      });
      setSelectedCategory("");
      setSelectedSupplier("");
    }
  }, [selectedProduct, openProductDialog, reset]);

  const buyPrice = watch("buyPrice");
  const minimumMarginPercent = watch("minimumMarginPercent");

  useEffect(() => {
    if (selectedProduct) {
      return;
    }

    const normalizedBuyPrice = Number(buyPrice) || 0;
    const normalizedMargin = Math.max(Number(minimumMarginPercent) || 0, 10);
    const recommendedSellPrice = normalizedBuyPrice + normalizedBuyPrice * (normalizedMargin / 100);

    setValue("sellPrice", recommendedSellPrice, {
      shouldValidate: true,
      shouldDirty: true,
    });
  }, [buyPrice, minimumMarginPercent, selectedProduct, setValue]);

  const calculateStatus = (quantity: number): string => {
    if (quantity > 20) return "Tersedia";
    if (quantity > 0 && quantity <= 20) return "Stok Menipis";
    return "Stok Habis";
  };

  const onSubmit = async (data: ProductFormData) => {
    setIsSubmitting(true); // Start loading
    const status: Product["status"] = calculateStatus(data.quantity);

    try {
      if (!selectedProduct) {
        const newProduct: Product = {
          id: Date.now().toString(),
          supplierId: selectedSupplier,
          name: data.productName,
          price: data.sellPrice,
          buyPrice: data.buyPrice,
          sellPrice: data.sellPrice,
          hetPrice: data.hetPrice,
          minimumMarginPercent: data.minimumMarginPercent,
          unit: data.unit,
          quantity: data.quantity,
          sku: data.sku,
          status,
          categoryId: selectedCategory,
          createdAt: new Date(),
          userId: userId,
        };

        const result = await addProduct(newProduct);

        if (result.success) {
          toast({
            title: "Produk berhasil dibuat!",
            description: `"${data.productName}" has been added to your inventory.`,
          });
          dialogCloseRef.current?.click();
          loadProducts();
          setOpenProductDialog(false);
        } else {
          toast({
            title: "Gagal membuat produk",
            description: "Failed to create the product. Please try again.",
            variant: "destructive",
          });
        }
      } else {
        const productToUpdate: Product = {
          id: selectedProduct.id,
          createdAt: new Date(selectedProduct.createdAt), // Convert string to Date
          supplierId: selectedSupplier,
          name: data.productName,
          price: data.sellPrice,
          buyPrice: data.buyPrice,
          sellPrice: data.sellPrice,
          hetPrice: data.hetPrice,
          minimumMarginPercent: data.minimumMarginPercent,
          unit: data.unit,
          quantity: data.quantity,
          sku: data.sku,
          status,
          categoryId: selectedCategory,
          userId: selectedProduct.userId,
        };

        const result = await updateProduct(productToUpdate);
        if (result.success) {
          toast({
            title: "Produk berhasil diperbarui!",
            description: `"${data.productName}" has been updated in your inventory.`,
          });
          loadProducts();
          setOpenProductDialog(false);
        } else {
          toast({
            title: "Gagal memperbarui produk",
            description: "Failed to update the product. Please try again.",
            variant: "destructive",
          });
        }
      }
    } catch (error: any) {
      toast({
        title: "Operation Failed",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false); // Stop loading
    }
  };

  const handleOpenChange = (open: boolean) => {
    if (open) {
      // When opening the dialog for adding a new product, clear any selected product
      setSelectedProduct(null);
    } else {
      // When closing the dialog, also clear the selected product to ensure clean state
      setSelectedProduct(null);
    }
    setOpenProductDialog(open);
  };

  return (
    <Dialog open={openProductDialog} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="h-10 font-semibold">+Tambah Produk</Button>
      </DialogTrigger>
      <DialogContent
        className="p-4 sm:p-7 sm:px-8 poppins max-h-[90vh] overflow-y-auto"
        aria-describedby="dialog-description"
      >
        <DialogHeader>
          <DialogTitle className="text-[22px]">
            {selectedProduct ? "Perbarui Produk" : "Tambah Produk"}
          </DialogTitle>
        </DialogHeader>
        <DialogDescription id="dialog-description">
          Isi detail produk di bawah ini.
        </DialogDescription>
        <FormProvider {...methods}>
          <form onSubmit={methods.handleSubmit(onSubmit)}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <ProductName />
              <SKU allProducts={allProducts} />
              <Quantity />
              <Unit />
              <Price
                fieldName="buyPrice"
                label="Harga Beli"
                placeholder="Harga beli..."
              />
              <Price
                fieldName="sellPrice"
                label="Harga Jual"
                placeholder="Harga jual..."
              />
              <Price
                fieldName="hetPrice"
                label="HET (Harga Eceran Tertinggi)"
                placeholder="HET..."
              />
              <Price
                fieldName="minimumMarginPercent"
                label="Margin Minimum (%)"
                placeholder="Default 10"
              />
              <div>
                <label htmlFor="category" className="block text-sm font-medium">
                  Kategori
                </label>
                <select
                  id="category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="mt-1 h-11 block w-full rounded-md border-gray-300 shadow-md focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Pilih Kategori</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="supplier" className="block text-sm font-medium">
                  Pemasok
                </label>
                <select
                  id="supplier"
                  value={selectedSupplier}
                  onChange={(e) => setSelectedSupplier(e.target.value)}
                  className="mt-1 h-11 block w-full rounded-md border-gray-300 shadow-md focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                >
                  <option value="">Pilih Pemasok</option>
                  {suppliers.map((supplier) => (
                    <option key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <DialogFooter className="mt-9 mb-4 flex flex-col sm:flex-row items-center gap-4">
              <DialogClose asChild>
                <Button
                  ref={dialogCloseRef}
                  variant="secondary"
                  className="h-11 w-full sm:w-auto px-11"
                >
                  Batal
                </Button>
              </DialogClose>
              <Button
                type="submit"
                className="h-11 w-full sm:w-auto px-11"
                isLoading={isSubmitting} // Button loading effect
              >
                {isSubmitting
                  ? "Memuat..."
                  : selectedProduct
                  ? "Perbarui Produk"
                  : "Tambah Produk"}
              </Button>
            </DialogFooter>
          </form>
        </FormProvider>
      </DialogContent>
    </Dialog>
  );
}
