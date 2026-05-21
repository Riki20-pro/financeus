"use client";

import { useState, useEffect, useMemo } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import {
  LogOut,
  Trash2,
  Edit2,
  TrendingUp,
  TrendingDown,
  Wallet,
  Filter,
  Users,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Transaction {
  id: string;
  nama: string;
  jumlah: number;
  tipe: "masuk" | "keluar";
  kategori: string;
  tanggal: string;
  user_id: string;
  user_email?: string;
}

interface UserProfile {
  email: string;
  nama: string;
}

// Daftar user resmi dari Supabase Auth kamu
const REGISTERED_USERS = [
  {
    id: "0c7e7a56-6f94-48b7-97c2-99fc229de164",
    email: "riki@gmail.com",
    nama: "Riki",
  },
  {
    id: "0410a1f4-e0fd-49ea-a554-0067f635556d",
    email: "joni@gmail.com",
    nama: "Joni",
  },
  {
    id: "d22638db-3109-48cc-abb8-c5ac4eb1071a",
    email: "anton@gmail.com",
    nama: "Anton",
  },
];

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(
    null,
  );

  // Form states
  const [nama, setNama] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [tipe, setTipe] = useState<"masuk" | "keluar">("masuk");
  const [kategori, setKategori] = useState("");
  const [tanggal, setTanggal] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Filter states
  const [filterType, setFilterType] = useState<
    "all" | "today" | "yesterday" | "manual"
  >("all");
  const [manualDate, setManualDate] = useState("");

  const isViewingOwnDashboard = useMemo(() => {
    return selectedUserEmail === (currentUser?.email || null);
  }, [selectedUserEmail, currentUser]);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        const user = data.session.user;
        setCurrentUser(user);
        setSelectedUserEmail(user.email || null);
      } else {
        window.location.href = "/login";
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!currentUser) return;

    fetchTransactions();

    const channel = supabase
      .channel("transactions_realtime_global")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transactions",
        },
        () => {
          fetchTransactions();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, selectedUserEmail, filterType, manualDate]);

  useEffect(() => {
    if (currentUser) {
      const dropdownUsers = [...REGISTERED_USERS];
      if (
        currentUser.email &&
        !dropdownUsers.some((u) => u.email === currentUser.email)
      ) {
        dropdownUsers.push({
          email: currentUser.email,
          nama:
            currentUser.user_metadata?.nama ||
            currentUser.email.split("@")[0] ||
            "My Account",
        });
      }
      setAllUsers(dropdownUsers);
    }
  }, [currentUser]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);

      // 1. Ambil semua data transaksi dari tabel
      let query = supabase
        .from("transactions")
        .select("*")
        .order("tanggal", { ascending: false });

      const { data, error } = await query;

      if (error) {
        console.error(
          "Error fetching transactions:",
          JSON.stringify(error, null, 2),
        );
        return;
      }

      let filteredData = data || [];

      // 2. Filter berdasarkan user yang dipilih di dropdown dashboard
      if (selectedUserEmail) {
        // Cari ID user berdasarkan email yang sedang aktif di dropdown
        const targetUser = REGISTERED_USERS.find(
          (u) => u.email === selectedUserEmail,
        );

        if (targetUser) {
          // Filter data transaksi yang memiliki user_id cocok dengan user tersebut
          filteredData = filteredData.filter(
            (t) => t.user_id === targetUser.id,
          );
        }
      }

      // 3. Filter berdasarkan waktu (Hari Ini / Kemarin / Manual)
      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .split("T")[0];

      if (filterType === "today") {
        filteredData = filteredData.filter((t) => t.tanggal === today);
      } else if (filterType === "yesterday") {
        filteredData = filteredData.filter((t) => t.tanggal === yesterday);
      } else if (filterType === "manual" && manualDate) {
        filteredData = filteredData.filter((t) => t.tanggal === manualDate);
      }

      // 4. Set data ke state transaksi
      setTransactions(filteredData);
    } catch (err) {
      console.error("Unexpected error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !isViewingOwnDashboard) return;

    const transactionData = {
      nama,
      jumlah: parseFloat(jumlah),
      tipe,
      kategori,
      tanggal,
      user_id: currentUser.id,
    };

    if (editingId) {
      const { error } = await supabase
        .from("transactions")
        .update(transactionData)
        .eq("id", editingId)
        .eq("user_id", currentUser.id);
      if (error) alert(error.message);
      setEditingId(null);
    } else {
      const { error } = await supabase
        .from("transactions")
        .insert([transactionData]);
      if (error) alert(error.message);
    }

    // RESET FORM
    setNama("");
    setJumlah("");
    setKategori("");
    setTanggal(new Date().toISOString().split("T")[0]);

    // TAMBAHKAN BARIS INI:
    // Memaksa aplikasi untuk menarik ulang data setelah simpan/edit berhasil
    await fetchTransactions();
  };

  const handleEdit = (t: Transaction) => {
    if (t.user_id !== currentUser?.id) {
      alert("Anda tidak memiliki izin untuk mengedit transaksi user lain.");
      return;
    }
    setEditingId(t.id);
    setNama(t.nama);
    setJumlah(t.jumlah.toString());
    setTipe(t.tipe);
    setKategori(t.kategori);
    setTanggal(t.tanggal);
  };

  const handleDelete = async (id: string, ownerId: string) => {
    if (ownerId !== currentUser?.id) {
      alert("Anda tidak memiliki izin untuk menghapus transaksi user lain.");
      return;
    }
    if (confirm("Are you sure?")) {
      const { error } = await supabase
        .from("transactions")
        .delete()
        .eq("id", id)
        .eq("user_id", currentUser.id);
      if (error) alert(error.message);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = "/login";
  };

  const totalMasuk = transactions
    .filter((t) => t.tipe === "masuk")
    .reduce((acc, curr) => acc + curr.jumlah, 0);
  const totalKeluar = transactions
    .filter((t) => t.tipe === "keluar")
    .reduce((acc, curr) => acc + curr.jumlah, 0);
  const sisaUang = totalMasuk - totalKeluar;

  if (!currentUser)
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        Loading...
      </div>
    );

  const currentUserDisplayName =
    currentUser.user_metadata?.nama ||
    currentUser.email?.split("@")[0] ||
    "My Account";

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 text-slate-50">
      <div className="mx-auto max-w-6xl space-y-8">
        <div className="flex items-center justify-between">
          <motion.h1
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="text-4xl font-bold tracking-tight"
          >
            Finance<span className="text-indigo-500">us</span>
          </motion.h1>
          <div className="flex items-center gap-4">
            <div className="hidden sm:flex flex-col items-end">
              <span className="text-xs text-slate-400">Aktif sebagai</span>
              <span className="text-sm font-medium text-indigo-300">
                {currentUserDisplayName}
              </span>
            </div>
            <Select
              value={selectedUserEmail || ""}
              onValueChange={setSelectedUserEmail}
            >
              <SelectTrigger className="w-[200px] bg-slate-800 border-slate-700 text-white text-xs h-9">
                <Users className="h-3 w-3 mr-2" />
                <SelectValue placeholder="Pilih Dashboard User" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-700 text-white">
                {allUsers.map((u) => (
                  <SelectItem key={u.email} value={u.email}>
                    {u.email === currentUser?.email
                      ? "Dashboard Saya"
                      : `Dashboard ${u.nama}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="text-slate-400 hover:text-white"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            title={`Sisa Uang (${isViewingOwnDashboard ? "Saya" : allUsers.find((u) => u.email === selectedUserEmail)?.nama || "User"})`}
            amount={sisaUang}
            icon={<Wallet className="h-5 w-5 text-indigo-400" />}
            className="border-indigo-500/20 bg-indigo-500/5"
          />
          <SummaryCard
            title={`Uang Masuk (${isViewingOwnDashboard ? "Saya" : allUsers.find((u) => u.email === selectedUserEmail)?.nama || "User"})`}
            amount={totalMasuk}
            icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
            className="border-emerald-500/20 bg-emerald-500/5"
          />
          <SummaryCard
            title={`Uang Keluar (${isViewingOwnDashboard ? "Saya" : allUsers.find((u) => u.email === selectedUserEmail)?.nama || "User"})`}
            amount={totalKeluar}
            icon={<TrendingDown className="h-5 w-5 text-rose-400" />}
            className="border-rose-500/20 bg-rose-500/5"
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {/* Form Section */}
          {isViewingOwnDashboard ? (
            <Card className="lg:col-span-4 bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-xl text-white">
                  {editingId ? "Update Transaksi" : "Tambah Transaksi"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label className="text-slate-400">Nama Transaksi</Label>
                    <Input
                      required
                      value={nama}
                      onChange={(e) => setNama(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="Contoh: Gaji Bulanan"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-400">Jumlah</Label>
                    <Input
                      required
                      type="number"
                      value={jumlah}
                      onChange={(e) => setJumlah(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="0"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-400">Tipe</Label>
                    <Select
                      value={tipe}
                      onValueChange={(val: any) => setTipe(val)}
                    >
                      <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                        <SelectValue placeholder="Pilih Tipe" />
                      </SelectTrigger>
                      <SelectContent className="bg-slate-800 border-slate-700 text-white">
                        <SelectItem value="masuk">Uang Masuk</SelectItem>
                        <SelectItem value="keluar">Uang Keluar</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-400">Kategori</Label>
                    <Input
                      required
                      value={kategori}
                      onChange={(e) => setKategori(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white"
                      placeholder="Contoh: Makanan, Transportasi"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-slate-400">Tanggal</Label>
                    <Input
                      required
                      type="date"
                      value={tanggal}
                      onChange={(e) => setTanggal(e.target.value)}
                      className="bg-slate-800 border-slate-700 text-white"
                    />
                  </div>
                  <Button
                    type="submit"
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    {editingId ? "Update" : "Simpan"}
                  </Button>
                  {editingId && (
                    <Button
                      type="button"
                      variant="ghost"
                      className="w-full text-slate-400"
                      onClick={() => {
                        setEditingId(null);
                        setNama("");
                        setJumlah("");
                        setKategori("");
                        setTanggal(new Date().toISOString().split("T")[0]);
                      }}
                    >
                      Batal
                    </Button>
                  )}
                </form>
              </CardContent>
            </Card>
          ) : (
            <Card className="lg:col-span-4 bg-slate-900 border-slate-800 flex items-center justify-center p-8 text-center">
              <div className="space-y-4">
                <Users className="h-12 w-12 text-slate-700 mx-auto" />
                <p className="text-slate-400 text-sm">
                  Anda sedang melihat dashboard{" "}
                  <strong>
                    {allUsers.find((u) => u.email === selectedUserEmail)
                      ?.nama || "User"}
                  </strong>
                  . Fitur CRUD hanya tersedia di dashboard Anda sendiri.
                </p>
              </div>
            </Card>
          )}

          {/* Table Section */}
          <Card className="lg:col-span-8 bg-slate-900 border-slate-800 overflow-hidden">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <CardTitle className="text-xl text-white">
                Riwayat Transaksi
              </CardTitle>
              <div className="flex items-center gap-2">
                <Select
                  value={filterType}
                  onValueChange={(val: any) => setFilterType(val)}
                >
                  <SelectTrigger className="w-[140px] bg-slate-800 border-slate-700 text-white text-xs h-9">
                    <Filter className="h-3 w-3 mr-2" />
                    <SelectValue placeholder="Filter Waktu" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="all">Semua Waktu</SelectItem>
                    <SelectItem value="today">Hari Ini</SelectItem>
                    <SelectItem value="yesterday">Kemarin</SelectItem>
                    <SelectItem value="manual">Manual...</SelectItem>
                  </SelectContent>
                </Select>
                {filterType === "manual" && (
                  <Input
                    type="date"
                    value={manualDate}
                    onChange={(e) => setManualDate(e.target.value)}
                    className="w-[140px] bg-slate-800 border-slate-700 text-white text-xs h-9"
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-slate-800/50">
                    <TableRow className="border-slate-800 hover:bg-transparent">
                      <TableHead className="text-slate-400">Tanggal</TableHead>
                      <TableHead className="text-slate-400">Oleh</TableHead>
                      <TableHead className="text-slate-400">Nama</TableHead>
                      <TableHead className="text-slate-400">Kategori</TableHead>
                      <TableHead className="text-right text-slate-400">
                        Jumlah
                      </TableHead>
                      {isViewingOwnDashboard && (
                        <TableHead className="text-right text-slate-400">
                          Aksi
                        </TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {transactions.map((t) => (
                        <motion.tr
                          key={t.id}
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="border-slate-800 hover:bg-slate-800/30 transition-colors"
                        >
                          <TableCell className="text-slate-300">
                            {new Date(t.tanggal).toLocaleDateString("id-ID")}
                          </TableCell>
                          <TableCell className="text-xs text-slate-400">
                            {t.user_email === currentUser?.email
                              ? "Saya"
                              : allUsers.find((u) => u.email === t.user_email)
                                  ?.nama ||
                                t.user_email?.split("@")[0] ||
                                "User Lain"}
                          </TableCell>
                          <TableCell className="font-medium text-white">
                            {t.nama}
                          </TableCell>
                          <TableCell>
                            <span className="rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-300">
                              {t.kategori}
                            </span>
                          </TableCell>
                          <TableCell
                            className={`text-right font-bold ${t.tipe === "masuk" ? "text-emerald-400" : "text-rose-400"}`}
                          >
                            {t.tipe === "masuk" ? "+" : "-"}
                            {new Intl.NumberFormat("id-ID", {
                              style: "currency",
                              currency: "IDR",
                            }).format(t.jumlah)}
                          </TableCell>
                          {isViewingOwnDashboard && (
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleEdit(t)}
                                  className="h-8 w-8 text-slate-400 hover:text-indigo-400"
                                >
                                  <Edit2 className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => handleDelete(t.id, t.user_id)}
                                  className="h-8 w-8 text-slate-400 hover:text-rose-400"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          )}
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                    {!loading && transactions.length === 0 && (
                      <TableRow>
                        <TableCell
                          colSpan={isViewingOwnDashboard ? 6 : 5}
                          className="h-32 text-center text-slate-500"
                        >
                          Belum ada transaksi untuk user ini.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  title,
  amount,
  icon,
  className,
}: {
  title: string;
  amount: number;
  icon: React.ReactNode;
  className?: string;
}) {
  return (
    <Card className={`bg-slate-900 border-slate-800 ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-white">
              {new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
              }).format(amount)}
            </p>
          </div>
          <div className="rounded-full p-2 bg-slate-950/50">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}
