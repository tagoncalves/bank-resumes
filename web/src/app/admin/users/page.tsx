"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus, Trash2, Pencil, X, Check, ShieldCheck, User } from "lucide-react";

interface UserRow {
  id: string;
  username: string;
  role: string;
  displayName: string | null;
  createdAt: string;
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({ username: "", password: "", role: "USER", displayName: "" });
  const [editForm, setEditForm] = useState({ role: "USER", displayName: "", password: "" });

  async function load() {
    setLoading(true);
    const r = await fetch("/api/admin/users");
    setUsers(await r.json());
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setForm({ username: "", password: "", role: "USER", displayName: "" });
    setShowForm(false);
    load();
  }

  async function handleEdit(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        role: editForm.role,
        displayName: editForm.displayName,
        ...(editForm.password ? { password: editForm.password } : {}),
      }),
    });
    const data = await res.json();
    if (!res.ok) { setError(data.error); return; }
    setEditingId(null);
    load();
  }

  async function handleDelete(id: string, username: string) {
    if (!confirm(`¿Eliminar al usuario "${username}"?`)) return;
    await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
    load();
  }

  function startEdit(u: UserRow) {
    setEditingId(u.id);
    setEditForm({ role: u.role, displayName: u.displayName ?? "", password: "" });
    setError(null);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900">Gestión de usuarios</h1>
          <p className="text-sm text-zinc-500">Solo accesible para administradores</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(null); }}
          className="flex items-center gap-1.5 rounded-md bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Nuevo usuario
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-zinc-700">Nuevo usuario</CardTitle>
              <button onClick={() => setShowForm(false)} className="text-zinc-400 hover:text-zinc-600">
                <X className="h-4 w-4" />
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Usuario</label>
                <input
                  type="text"
                  value={form.username}
                  onChange={(e) => setForm((f) => ({ ...f, username: e.target.value }))}
                  required
                  className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Nombre</label>
                <input
                  type="text"
                  value={form.displayName}
                  onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                  className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Contraseña</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                  required
                  className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-zinc-500">Rol</label>
                <select
                  value={form.role}
                  onChange={(e) => setForm((f) => ({ ...f, role: e.target.value }))}
                  className="w-full rounded border border-zinc-200 bg-white px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                >
                  <option value="USER">Usuario</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
              {error && <p className="col-span-4 text-xs text-red-600">{error}</p>}
              <div className="col-span-4 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowForm(false)}
                  className="rounded px-3 py-1.5 text-sm text-zinc-600 hover:bg-zinc-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="rounded bg-indigo-600 px-4 py-1.5 text-sm text-white hover:bg-indigo-700"
                >
                  Crear
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Users table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-zinc-400">Cargando...</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-100 bg-zinc-50 text-xs text-zinc-500">
                  <th className="px-5 py-2.5 text-left font-medium">Usuario</th>
                  <th className="px-5 py-2.5 text-left font-medium">Nombre</th>
                  <th className="px-5 py-2.5 text-left font-medium">Rol</th>
                  <th className="px-5 py-2.5 text-left font-medium">Creado</th>
                  <th className="w-24 px-5 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-zinc-50 hover:bg-zinc-50/50">
                    <td className="px-5 py-2.5 font-mono text-xs text-zinc-700">{u.username}</td>
                    <td className="px-5 py-2.5 text-zinc-700">
                      {editingId === u.id ? (
                        <input
                          type="text"
                          value={editForm.displayName}
                          onChange={(e) => setEditForm((f) => ({ ...f, displayName: e.target.value }))}
                          className="w-full rounded border border-zinc-200 px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        />
                      ) : (
                        u.displayName ?? <span className="text-zinc-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-2.5">
                      {editingId === u.id ? (
                        <select
                          value={editForm.role}
                          onChange={(e) => setEditForm((f) => ({ ...f, role: e.target.value }))}
                          className="rounded border border-zinc-200 px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                        >
                          <option value="USER">Usuario</option>
                          <option value="ADMIN">Admin</option>
                        </select>
                      ) : (
                        <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          u.role === "ADMIN"
                            ? "bg-indigo-50 text-indigo-700"
                            : "bg-zinc-100 text-zinc-600"
                        }`}>
                          {u.role === "ADMIN"
                            ? <ShieldCheck className="h-3 w-3" />
                            : <User className="h-3 w-3" />}
                          {u.role === "ADMIN" ? "Admin" : "Usuario"}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-2.5 text-xs text-zinc-400">
                      {new Date(u.createdAt).toLocaleDateString("es-AR")}
                    </td>
                    <td className="px-5 py-2.5">
                      {editingId === u.id ? (
                        <div className="flex items-center gap-2">
                          <div>
                            <input
                              type="password"
                              placeholder="Nueva contraseña"
                              value={editForm.password}
                              onChange={(e) => setEditForm((f) => ({ ...f, password: e.target.value }))}
                              className="w-32 rounded border border-zinc-200 px-2 py-0.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-300"
                            />
                          </div>
                          <button onClick={() => handleEdit(u.id)} className="text-emerald-600 hover:text-emerald-700">
                            <Check className="h-4 w-4" />
                          </button>
                          <button onClick={() => setEditingId(null)} className="text-zinc-400 hover:text-zinc-600">
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <button onClick={() => startEdit(u)} className="text-zinc-400 hover:text-zinc-600">
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => handleDelete(u.id, u.username)} className="text-zinc-400 hover:text-red-500">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {error && editingId && (
            <p className="px-5 pb-3 text-xs text-red-600">{error}</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
