"use client";

import AuthenticatedLayout from "@/app/components/AuthenticatedLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import axiosInstance from "@/utils/axiosInstance";
import { useEffect, useMemo, useState } from "react";

interface SupplierRecord {
  id: string;
  name: string;
  contactName?: string | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

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

export default function SuppliersPage() {
  const { toast } = useToast();
  const [suppliers, setSuppliers] = useState<SupplierRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState<SupplierForm>(emptyForm);
  const [isSaving, setIsSaving] = useState(false);

  const [editingSupplier, setEditingSupplier] = useState<SupplierRecord | null>(null);
  const [editForm, setEditForm] = useState<SupplierForm>(emptyForm);
  const [deletingSupplierId, setDeletingSupplierId] = useState<string | null>(null);

  const loadSuppliers = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get("/suppliers");
      setSuppliers(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      toast({
        title: "Gagal memuat data supplier",
        description: error?.response?.data?.error || "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSuppliers();
  }, []);

  const filteredSuppliers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return suppliers;

    return suppliers.filter((supplier) =>
      [supplier.name, supplier.contactName || "", supplier.phone || "", supplier.email || "", supplier.address || ""]
        .join(" ")
        .toLowerCase()
        .includes(q)
    );
  }, [suppliers, search]);

  const createSupplier = async () => {
    if (!createForm.name.trim()) {
      toast({ title: "Nama supplier wajib diisi", variant: "destructive" });
      return;
    }

    try {
      setIsSaving(true);
      await axiosInstance.post("/suppliers", createForm);
      toast({ title: "Supplier berhasil ditambahkan" });
      setIsCreateOpen(false);
      setCreateForm(emptyForm);
      await loadSuppliers();
    } catch (error: any) {
      toast({
        title: "Gagal menambah supplier",
        description: error?.response?.data?.error || "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const openEdit = (supplier: SupplierRecord) => {
    setEditingSupplier(supplier);
    setEditForm({
      name: supplier.name || "",
      contactName: supplier.contactName || "",
      phone: supplier.phone || "",
      email: supplier.email || "",
      address: supplier.address || "",
    });
  };

  const saveEdit = async () => {
    if (!editingSupplier) return;
    if (!editForm.name.trim()) {
      toast({ title: "Nama supplier wajib diisi", variant: "destructive" });
      return;
    }

    try {
      setIsSaving(true);
      await axiosInstance.put("/suppliers", { id: editingSupplier.id, ...editForm });
      toast({ title: "Supplier berhasil diperbarui" });
      setEditingSupplier(null);
      await loadSuppliers();
    } catch (error: any) {
      toast({
        title: "Gagal memperbarui supplier",
        description: error?.response?.data?.error || "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteSupplier = async (supplier: SupplierRecord) => {
    const confirmed = window.confirm(`Hapus supplier ${supplier.name}?`);
    if (!confirmed) return;

    try {
      setDeletingSupplierId(supplier.id);
      await axiosInstance.delete("/suppliers", { data: { id: supplier.id } });
      toast({ title: "Supplier berhasil dihapus" });
      await loadSuppliers();
    } catch (error: any) {
      toast({
        title: "Gagal menghapus supplier",
        description: error?.response?.data?.error || "Silakan coba lagi.",
        variant: "destructive",
      });
    } finally {
      setDeletingSupplierId(null);
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 p-4 lg:p-0">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle>Tabel Data Supplier</CardTitle>
            <Button type="button" onClick={() => setIsCreateOpen(true)}>+ Tambah Supplier</Button>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Cari supplier berdasarkan nama, kontak, telepon, email, alamat..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Memuat data supplier...</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nama Supplier</TableHead>
                    <TableHead>Nama Kontak</TableHead>
                    <TableHead>Telepon</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Alamat</TableHead>
                    <TableHead>Dibuat</TableHead>
                    <TableHead>Diperbarui</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredSuppliers.map((supplier) => (
                    <TableRow key={supplier.id}>
                      <TableCell>{supplier.name}</TableCell>
                      <TableCell>{supplier.contactName || "-"}</TableCell>
                      <TableCell>{supplier.phone || "-"}</TableCell>
                      <TableCell>{supplier.email || "-"}</TableCell>
                      <TableCell>{supplier.address || "-"}</TableCell>
                      <TableCell>{supplier.createdAt ? new Date(supplier.createdAt).toLocaleString("id-ID") : "-"}</TableCell>
                      <TableCell>{supplier.updatedAt ? new Date(supplier.updatedAt).toLocaleString("id-ID") : "-"}</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => openEdit(supplier)}>
                            Edit
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="destructive"
                            disabled={deletingSupplierId === supplier.id}
                            onClick={() => deleteSupplier(supplier)}
                          >
                            {deletingSupplierId === supplier.id ? "Menghapus..." : "Hapus"}
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {!filteredSuppliers.length && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground">
                        Tidak ada data supplier.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tambah Supplier</DialogTitle>
            </DialogHeader>
            <SupplierFormFields form={createForm} setForm={setCreateForm} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Batal</Button>
              <Button onClick={createSupplier} disabled={isSaving}>{isSaving ? "Menyimpan..." : "Simpan"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Dialog open={Boolean(editingSupplier)} onOpenChange={(open) => !open && setEditingSupplier(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ubah Supplier</DialogTitle>
            </DialogHeader>
            <SupplierFormFields form={editForm} setForm={setEditForm} />
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingSupplier(null)}>Batal</Button>
              <Button onClick={saveEdit} disabled={isSaving}>{isSaving ? "Menyimpan..." : "Simpan"}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
}

function SupplierFormFields({
  form,
  setForm,
}: {
  form: SupplierForm;
  setForm: React.Dispatch<React.SetStateAction<SupplierForm>>;
}) {
  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>Nama Supplier</Label>
        <Input value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Nama Kontak</Label>
        <Input value={form.contactName} onChange={(e) => setForm((prev) => ({ ...prev, contactName: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Telepon</Label>
        <Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
      </div>
      <div className="space-y-2">
        <Label>Alamat</Label>
        <Input value={form.address} onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))} />
      </div>
    </div>
  );
}
