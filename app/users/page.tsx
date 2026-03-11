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
import { useEffect, useState } from "react";
import { useAuth } from "../authContext";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
  lokasi: string;
  createdAt: string;
  updatedAt: string;
}

interface UsersResponse {
  users: UserRecord[];
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

interface EditForm {
  name: string;
  username: string;
  role: "ADMIN" | "USER" | "DEV";
  lokasi: string;
}

export default function UsersPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const isDev = (user?.role || "USER").toUpperCase() === "DEV";
  const [data, setData] = useState<UsersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", username: "", role: "USER", lokasi: "PUSAT" });
  const [isSaving, setIsSaving] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const response = await axiosInstance.get("/users", {
        params: { limit: 10, page, search },
      });
      setData(response.data);
    } catch (error: any) {
      toast({
        title: "Gagal memuat data pengguna",
        description: error?.response?.data?.error || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, [page, search]);

  const openEditDialog = (user: UserRecord) => {
    setEditingUser(user);
    setEditForm({
      name: user.name,
      username: user.username || "",
      role: user.role === "ADMIN" ? "ADMIN" : user.role === "DEV" ? "DEV" : "USER",
      lokasi: user.lokasi || "PUSAT",
    });
  };

  const saveEdit = async () => {
    if (!editingUser) return;
    if (!isDev) {
      toast({ title: "Akses ditolak", description: "Hanya role DEV yang dapat mengubah data pengguna.", variant: "destructive" });
      return;
    }

    try {
      setIsSaving(true);
      await axiosInstance.put(`/users/${editingUser.id}`, {
        name: editForm.name,
        username: editForm.username,
        role: editForm.role,
        lokasi: editForm.lokasi,
      });
      toast({ title: "Pengguna diperbarui", description: "Data pengguna berhasil diperbarui." });
      setEditingUser(null);
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Gagal memperbarui pengguna",
        description: error?.response?.data?.error || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteUser = async (user: UserRecord) => {
    if (!isDev) {
      toast({ title: "Akses ditolak", description: "Hanya role DEV yang dapat mengubah data pengguna.", variant: "destructive" });
      return;
    }

    const confirmed = window.confirm(`Hapus pengguna ${user.name}? Tindakan ini tidak dapat dibatalkan.`);
    if (!confirmed) return;

    try {
      setDeletingUserId(user.id);
      await axiosInstance.delete(`/users/${user.id}`);
      toast({ title: "Pengguna dihapus", description: "Pengguna telah dihapus." });
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Gagal menghapus pengguna",
        description: error?.response?.data?.error || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setDeletingUserId(null);
    }
  };

  return (
    <AuthenticatedLayout>
      <div className="space-y-6 p-4 lg:p-0">
        <Card>
          <CardHeader>
            <CardTitle>Tabel Data Pengguna</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Cari berdasarkan nama, email, username, peran..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />

            {!isDev && <p className="text-xs text-muted-foreground">Hanya role DEV dapat edit/hapus data pengguna.</p>}

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Memuat data pengguna...</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nama</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Nama Pengguna</TableHead>
                      <TableHead>Peran</TableHead>
                      <TableHead>Lokasi</TableHead>
                      <TableHead>Dibuat</TableHead>
                      <TableHead>Diperbarui</TableHead>
                      <TableHead>Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.username || "-"}</TableCell>
                        <TableCell>{user.role || "ADMIN"}</TableCell>
                        <TableCell>{user.lokasi || "PUSAT"}</TableCell>
                        <TableCell>{new Date(user.createdAt).toLocaleString("id-ID")}</TableCell>
                        <TableCell>{new Date(user.updatedAt).toLocaleString("id-ID")}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => openEditDialog(user)} disabled={!isDev}>
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteUser(user)}
                              disabled={!isDev || deletingUserId === user.id}
                            >
                              {deletingUserId === user.id ? "Menghapus..." : "Hapus"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!data?.users.length && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground">
                          Tidak ada data pengguna.
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
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!data?.pagination.hasPrev}
                      onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                    >
                      Sebelumnya
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!data?.pagination.hasNext}
                      onClick={() => setPage((prev) => prev + 1)}
                    >
                      Berikutnya
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <Dialog open={Boolean(editingUser)} onOpenChange={(open) => !open && setEditingUser(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Ubah Pengguna</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Nama</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Nama Pengguna</Label>
                <Input
                  value={editForm.username}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, username: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Lokasi</Label>
                <Input
                  value={editForm.lokasi}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, lokasi: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Peran</Label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value === "ADMIN" ? "ADMIN" : e.target.value === "DEV" ? "DEV" : "USER" }))}
                  className="w-full h-10 rounded-md border bg-background px-3"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                  <option value="DEV">DEV</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={saveEdit} disabled={isSaving}>
                {isSaving ? "Menyimpan..." : "Simpan"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
}
