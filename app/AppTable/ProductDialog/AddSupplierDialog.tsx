"use client";

import { useState, useEffect } from "react";
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
import { Input } from "@/components/ui/input";
import { useProductStore } from "@/app/useProductStore";
import { useToast } from "@/hooks/use-toast";
import { FaEdit, FaTrash } from "react-icons/fa";
import { useAuth } from "@/app/authContext";
import axiosInstance from "@/utils/axiosInstance";

interface SupplierForm {
  name: string;
  contactName: string;
  phone: string;
  email: string;
  address: string;
}

const emptyForm: SupplierForm = {
  name: "",
  contactName: "",
  phone: "",
  email: "",
  address: "",
};

export default function AddSupplierDialog() {
  const [supplierForm, setSupplierForm] = useState<SupplierForm>(emptyForm);
  const [editingSupplier, setEditingSupplier] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<SupplierForm>(emptyForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { suppliers, addSupplier, editSupplier, deleteSupplier, loadSuppliers } = useProductStore();
  const { toast } = useToast();
  const { isLoggedIn } = useAuth();

  useEffect(() => {
    if (isLoggedIn) {
      loadSuppliers();
    }
  }, [isLoggedIn, loadSuppliers]);

  const handleAddSupplier = async () => {
    if (supplierForm.name.trim() === "") {
      toast({
        title: "Error",
        description: "Supplier name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await axiosInstance.post("/suppliers", supplierForm);

      if (response.status !== 201) {
        throw new Error("Failed to add supplier");
      }

      addSupplier(response.data);
      setSupplierForm(emptyForm);
      toast({
        title: "Supplier Created Successfully!",
        description: `"${response.data.name}" has been added to your suppliers.`,
      });
    } catch (error) {
      console.error("Error adding supplier:", error);
      toast({
        title: "Creation Failed",
        description: "Failed to create the supplier. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditSupplier = async (supplierId: string) => {
    if (editingForm.name.trim() === "") {
      toast({
        title: "Error",
        description: "Supplier name cannot be empty",
        variant: "destructive",
      });
      return;
    }

    setIsEditing(true);
    try {
      const response = await axiosInstance.put("/suppliers", {
        id: supplierId,
        ...editingForm,
      });

      if (response.status !== 200) {
        throw new Error("Failed to edit supplier");
      }

      editSupplier(response.data);
      setEditingSupplier(null);
      setEditingForm(emptyForm);
      toast({
        title: "Supplier Updated Successfully!",
        description: `"${response.data.name}" has been updated in your suppliers.`,
      });
    } catch (error) {
      console.error("Error editing supplier:", error);
      toast({
        title: "Update Failed",
        description: "Failed to update the supplier. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsEditing(false);
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    setIsDeleting(true);

    const supplierToDelete = suppliers.find((sup) => sup.id === supplierId);
    const supplierName = supplierToDelete?.name || "Unknown Supplier";

    try {
      const response = await axiosInstance.delete("/suppliers", {
        data: { id: supplierId },
      });

      if (response.status !== 204) {
        throw new Error("Failed to delete supplier");
      }

      deleteSupplier(supplierId);
      toast({
        title: "Supplier Deleted Successfully!",
        description: `"${supplierName}" has been permanently deleted.`,
      });
    } catch (error) {
      console.error("Error deleting supplier:", error);
      toast({
        title: "Delete Failed",
        description: "Failed to delete the supplier. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (!isLoggedIn) {
    return null;
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button className="h-10 font-semibold">+Add Supplier</Button>
      </DialogTrigger>
      <DialogContent
        className="p-4 sm:p-7 sm:px-8 poppins max-h-[90vh] overflow-y-auto"
        aria-describedby="supplier-dialog-description"
      >
        <DialogHeader>
          <DialogTitle className="text-[22px]">Add Supplier</DialogTitle>
        </DialogHeader>
        <DialogDescription id="supplier-dialog-description">
          Enter supplier details (name, contact, phone, email, and address)
        </DialogDescription>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-4">
          <Input
            value={supplierForm.name}
            onChange={(e) => setSupplierForm((prev) => ({ ...prev, name: e.target.value }))}
            placeholder="Supplier Name"
          />
          <Input
            value={supplierForm.contactName}
            onChange={(e) => setSupplierForm((prev) => ({ ...prev, contactName: e.target.value }))}
            placeholder="Nama Kontak"
          />
          <Input
            value={supplierForm.phone}
            onChange={(e) => setSupplierForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="Nomor Telepon"
          />
          <Input
            value={supplierForm.email}
            onChange={(e) => setSupplierForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="Email"
          />
          <div className="md:col-span-2">
            <Input
              value={supplierForm.address}
              onChange={(e) => setSupplierForm((prev) => ({ ...prev, address: e.target.value }))}
              placeholder="Alamat"
            />
          </div>
        </div>

        <DialogFooter className="mt-9 mb-4 flex flex-col sm:flex-row items-center gap-4">
          <DialogClose asChild>
            <Button variant={"secondary"} className="h-11 w-full sm:w-auto px-11">
              Cancel
            </Button>
          </DialogClose>
          <Button onClick={handleAddSupplier} className="h-11 w-full sm:w-auto px-11" disabled={isSubmitting}>
            {isSubmitting ? "Creating..." : "Add Supplier"}
          </Button>
        </DialogFooter>

        <div className="mt-4">
          <h3 className="text-lg font-semibold">Suppliers</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
            {suppliers.map((supplier) => (
              <div key={supplier.id} className="p-4 border rounded-lg shadow-sm flex flex-col justify-between">
                {editingSupplier === supplier.id ? (
                  <div className="flex flex-col space-y-2">
                    <Input
                      value={editingForm.name}
                      onChange={(e) => setEditingForm((prev) => ({ ...prev, name: e.target.value }))}
                      placeholder="Supplier Name"
                      className="h-8"
                    />
                    <Input
                      value={editingForm.contactName}
                      onChange={(e) => setEditingForm((prev) => ({ ...prev, contactName: e.target.value }))}
                      placeholder="Nama Kontak"
                      className="h-8"
                    />
                    <Input
                      value={editingForm.phone}
                      onChange={(e) => setEditingForm((prev) => ({ ...prev, phone: e.target.value }))}
                      placeholder="Nomor Telepon"
                      className="h-8"
                    />
                    <Input
                      value={editingForm.email}
                      onChange={(e) => setEditingForm((prev) => ({ ...prev, email: e.target.value }))}
                      placeholder="Email"
                      className="h-8"
                    />
                    <Input
                      value={editingForm.address}
                      onChange={(e) => setEditingForm((prev) => ({ ...prev, address: e.target.value }))}
                      placeholder="Alamat"
                      className="h-8"
                    />
                    <div className="flex justify-between gap-2">
                      <Button onClick={() => handleEditSupplier(supplier.id)} className="h-8 w-full" disabled={isEditing}>
                        {isEditing ? "Saving..." : "Save"}
                      </Button>
                      <Button onClick={() => setEditingSupplier(null)} className="h-8 w-full">
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col space-y-2">
                    <span className="font-medium">{supplier.name}</span>
                    <span className="text-xs text-muted-foreground">Kontak: {supplier.contactName || "-"}</span>
                    <span className="text-xs text-muted-foreground">Telepon: {supplier.phone || "-"}</span>
                    <span className="text-xs text-muted-foreground">Email: {supplier.email || "-"}</span>
                    <span className="text-xs text-muted-foreground">Alamat: {supplier.address || "-"}</span>
                    <div className="flex justify-between gap-2">
                      <Button
                        onClick={() => {
                          setEditingSupplier(supplier.id);
                          setEditingForm({
                            name: supplier.name,
                            contactName: supplier.contactName || "",
                            phone: supplier.phone || "",
                            email: supplier.email || "",
                            address: supplier.address || "",
                          });
                        }}
                        className="h-8 w-full"
                      >
                        <FaEdit />
                      </Button>
                      <Button onClick={() => handleDeleteSupplier(supplier.id)} className="h-8 w-full" disabled={isDeleting}>
                        {isDeleting ? "Deleting..." : <FaTrash />}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
