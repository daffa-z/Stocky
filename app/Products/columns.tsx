"use client";

import { Product } from "@/app/types";
import { Column, ColumnDef } from "@tanstack/react-table";
//import { ReactNode } from "react";

import ProductDropDown from "./ProductsDropDown";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { QRCodeHover } from "@/components/ui/qr-code-hover";
import { AlertTriangle, ArrowUpDown } from "lucide-react";
import { IoMdArrowDown, IoMdArrowUp } from "react-icons/io";

type SortableHeaderProps = {
  column: Column<Product, unknown>;
  label: string;
};

const SortableHeader: React.FC<SortableHeaderProps> = ({ column, label }) => {
  const isSorted = column.getIsSorted();
  const SortingIcon =
    isSorted === "asc"
      ? IoMdArrowUp
      : isSorted === "desc"
        ? IoMdArrowDown
        : ArrowUpDown;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="" asChild>
        <div
          className={`flex items-start py-[14px] select-none cursor-pointer p-2 gap-1 ${isSorted && "text-primary"
            }`}
          aria-label={`Sort by ${label}`}
        >
          {label}
          <SortingIcon className="h-4 w-4" />
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom">
        {/* Ascending Sorting */}
        <DropdownMenuItem onClick={() => column.toggleSorting(false)}>
          <IoMdArrowUp className="mr-2 h-4 w-4" />
          Asc
        </DropdownMenuItem>
        {/* Descending Sorting */}
        <DropdownMenuItem onClick={() => column.toggleSorting(true)}>
          <IoMdArrowDown className="mr-2 h-4 w-4" />
          Desc
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const columns: ColumnDef<Product>[] = [
  {
    accessorKey: "createdAt",
    header: ({ column }) => (
      <SortableHeader column={column} label="Tanggal Input" />
    ),
    cell: ({ getValue }) => {
      const dateValue = getValue<string | Date>();
      const date =
        typeof dateValue === "string" ? new Date(dateValue) : dateValue;

      if (!date || isNaN(date.getTime())) {
        return <span>Tanggal Tidak Diketahui</span>;
      }

      return (
        <span>
          {date.toLocaleDateString("id-ID", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </span>
      );
    },
  },
  {
    accessorKey: "name",
    cell: ({ row }) => {
      const name = row.original.name;
      return <span>{name}</span>;
    },
    header: ({ column }) => <SortableHeader column={column} label="Nama Barang" />,
  },
  {
    accessorKey: "sku",
    header: ({ column }) => <SortableHeader column={column} label="SKU" />,
  },
  {
    accessorKey: "quantity",
    header: ({ column }) => <SortableHeader column={column} label="Stok" />,
    cell: ({ row }) => {
      const quantity = row.original.quantity;
      const isLowStock = quantity > 0 && quantity < 10;
      const isOutOfStock = quantity === 0;

      return (
        <div className="flex items-center gap-2">
          <span className={isLowStock || isOutOfStock ? "font-semibold" : ""}>
            {quantity}
          </span>
          {isLowStock && (
            <AlertTriangle className="h-4 w-4 text-orange-500" />
          )}
          {isOutOfStock && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
        </div>
      );
    },
  },
  {
    accessorKey: "unit",
    header: ({ column }) => <SortableHeader column={column} label="Satuan" />,
    cell: ({ row }) => <span>{row.original.unit || "pcs"}</span>,
  },
  {
    accessorKey: "buyPrice",
    header: ({ column }) => <SortableHeader column={column} label="Harga Beli" />,
    cell: ({ row }) => {
      const value = row.original.buyPrice ?? row.original.price;
      return <span>{`Rp${value.toLocaleString("id-ID")}`}</span>;
    },
  },
  {
    accessorKey: "sellPrice",
    header: ({ column }) => <SortableHeader column={column} label="Harga Jual" />,
    cell: ({ row }) => {
      const value = row.original.sellPrice ?? row.original.price;
      return <span>{`Rp${value.toLocaleString("id-ID")}`}</span>;
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => <SortableHeader column={column} label="Status" />,
    cell: ({ row }) => {
      const quantity = row.original.quantity;
      let status = "";
      let colorClass = "";

      if (quantity > 20) {
        status = "Tersedia";
        colorClass = "bg-green-100 text-green-600";
      } else if (quantity > 0 && quantity <= 20) {
        status = "Stok Menipis";
        colorClass = "bg-orange-100 text-orange-600";
      } else {
        status = "Stok Habis";
        colorClass = "bg-red-100 text-red-600";
      }

      return (
        <span
          className={`px-3 py-[2px] rounded-full font-medium ${colorClass} flex gap-1 items-center w-fit`}
        >
          {status}
        </span>
      );
    },
  },
  {
    accessorKey: "category",
    header: "Kategori",
    cell: ({ row }) => {
      const categoryName = row.original.category;
      return <span>{categoryName || "Tidak Diketahui"}</span>;
    },
  },
  {
    accessorKey: "supplier",
    header: "Supplier",
    cell: ({ row }) => {
      const supplierName = row.original.supplier; // Display supplier name
      return <span>{supplierName || "Tidak Diketahui"}</span>;
    },
  },
  {
    id: "qrCode",
    header: "QRCode",
    cell: ({ row }) => {
      const product = row.original;
      const qrData = JSON.stringify({
        id: product.id,
        name: product.name,
        sku: product.sku,
        unit: product.unit,
        hargaBeli: product.buyPrice ?? product.price,
        hargaJual: product.sellPrice ?? product.price,
        quantity: product.quantity,
        status: product.status,
        category: product.category,
        supplier: product.supplier,
      });

      return (
        <QRCodeHover
          data={qrData}
          title={`${product.name} QR`}
          size={200}
        />
      );
    },
  },
  {
    id: "actions",
    cell: ({ row }) => {
      return <ProductDropDown row={row} />;
    },
  },
];

// Debug log for columns - only log in development
if (process.env.NODE_ENV === 'development') {
  console.log("Columns passed to useReactTable:", columns);
}
