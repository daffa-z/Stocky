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

interface UserRecord {
  id: string;
  name: string;
  email: string;
  username: string;
  role: string;
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
  role: "ADMIN" | "USER";
}

export default function UsersPage() {
  const { toast } = useToast();
  const [data, setData] = useState<UsersResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editForm, setEditForm] = useState<EditForm>({ name: "", username: "", role: "USER" });
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
        title: "Failed to load users",
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
      role: user.role === "ADMIN" ? "ADMIN" : "USER",
    });
  };

  const saveEdit = async () => {
    if (!editingUser) return;

    try {
      setIsSaving(true);
      await axiosInstance.put(`/users/${editingUser.id}`, {
        name: editForm.name,
        username: editForm.username,
        role: editForm.role,
      });
      toast({ title: "User updated", description: "User data has been updated." });
      setEditingUser(null);
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Failed to update user",
        description: error?.response?.data?.error || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const deleteUser = async (user: UserRecord) => {
    const confirmed = window.confirm(`Delete user ${user.name}? This action cannot be undone.`);
    if (!confirmed) return;

    try {
      setDeletingUserId(user.id);
      await axiosInstance.delete(`/users/${user.id}`);
      toast({ title: "User deleted", description: "User has been removed." });
      await loadUsers();
    } catch (error: any) {
      toast({
        title: "Failed to delete user",
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
            <CardTitle>User Data Table</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              placeholder="Search by name, email, username, role..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />

            {isLoading ? (
              <p className="text-sm text-muted-foreground">Loading users...</p>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Username</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data?.users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.name}</TableCell>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>{user.username || "-"}</TableCell>
                        <TableCell>{user.role || "ADMIN"}</TableCell>
                        <TableCell>{new Date(user.createdAt).toLocaleString("id-ID")}</TableCell>
                        <TableCell>{new Date(user.updatedAt).toLocaleString("id-ID")}</TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button type="button" size="sm" variant="outline" onClick={() => openEditDialog(user)}>
                              Edit
                            </Button>
                            <Button
                              type="button"
                              size="sm"
                              variant="destructive"
                              onClick={() => deleteUser(user)}
                              disabled={deletingUserId === user.id}
                            >
                              {deletingUserId === user.id ? "Deleting..." : "Delete"}
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                    {!data?.users.length && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-muted-foreground">
                          No user data found.
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
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!data?.pagination.hasNext}
                      onClick={() => setPage((prev) => prev + 1)}
                    >
                      Next
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
              <DialogTitle>Edit User</DialogTitle>
            </DialogHeader>

            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Name</Label>
                <Input
                  value={editForm.name}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Username</Label>
                <Input
                  value={editForm.username}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, username: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label>Role</Label>
                <select
                  value={editForm.role}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, role: e.target.value === "ADMIN" ? "ADMIN" : "USER" }))}
                  className="w-full h-10 rounded-md border bg-background px-3"
                >
                  <option value="USER">USER</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditingUser(null)}>
                Cancel
              </Button>
              <Button type="button" onClick={saveEdit} disabled={isSaving}>
                {isSaving ? "Saving..." : "Save"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </AuthenticatedLayout>
  );
}
