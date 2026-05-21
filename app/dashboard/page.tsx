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
  id: string;
  email: string;
  nama: string;
}

export default function DashboardPage() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<UserProfile[]>([]);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(
    null,
  );

  const [nama, setNama] = useState("");
  const [jumlah, setJumlah] = useState("");
  const [tipe, setTipe] = useState<"masuk" | "keluar">("masuk");
  const [kategori, setKategori] = useState("");
  const [tanggal, setTanggal] = useState(
    new Date().toISOString().split("T")[0],
  );

  // Perbaikan: Ganti filter 'manual' jadi 'custom' dan tambah state customDate
  const [filterType, setFilterType] = useState<
    "all" | "today" | "yesterday" | "custom"
  >("all");
  const [customDate, setCustomDate] = useState(
    new Date().toISOString().split("T")[0],
  );

  const isViewingOwnDashboard = useMemo(() => {
    return selectedUserEmail === (currentUser?.email || null);
  }, [selectedUserEmail, currentUser]);

  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setCurrentUser(data.session.user);
        setSelectedUserEmail(data.session.user.email || null);
      } else {
        window.location.href = "/login";
      }
    };
    getUser();
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    const fetchAllUsers = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, email, nama");
      if (data) {
        const isMeInList = data.some((u) => u.email === currentUser.email);
        let usersList = [...data];
        if (!isMeInList) {
          usersList.push({
            id: currentUser.id,
            email: currentUser.email || "",
            nama:
              currentUser.user_metadata?.nama ||
              currentUser.email?.split("@")[0] ||
              "Saya",
          });
        }
        setAllUsers(usersList);
      }
    };
    fetchAllUsers();
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) return;
    fetchTransactions();
    const channel = supabase
      .channel("transactions_realtime_global")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transactions" },
        () => fetchTransactions(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [currentUser, selectedUserEmail, filterType, customDate]);

  const fetchTransactions = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from("transactions")
        .select("*")
        .order("tanggal", { ascending: false });
      const { data, error } = await query;
      if (error) return;

      let filteredData = data || [];

      if (selectedUserEmail) {
        const targetUser = allUsers.find((u) => u.email === selectedUserEmail);
        if (targetUser) {
          filteredData = filteredData.filter(
            (t) => t.user_id === targetUser.id,
          );
        }
      }

      const today = new Date().toISOString().split("T")[0];
      const yesterday = new Date(Date.now() - 86400000)
        .toISOString()
        .split("T")[0];

      if (filterType === "today")
        filteredData = filteredData.filter((t) => t.tanggal === today);
      else if (filterType === "yesterday")
        filteredData = filteredData.filter((t) => t.tanggal === yesterday);
      else if (filterType === "custom")
        filteredData = filteredData.filter((t) => t.tanggal === customDate);

      setTransactions(filteredData);
    } catch (err) {
      console.error(err);
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
      await supabase
        .from("transactions")
        .update(transactionData)
        .eq("id", editingId);
      setEditingId(null);
    } else {
      await supabase.from("transactions").insert([transactionData]);
    }
    setNama("");
    setJumlah("");
    setKategori("");
    setTanggal(new Date().toISOString().split("T")[0]);
    await fetchTransactions();
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
            <Select
              value={selectedUserEmail || ""}
              onValueChange={setSelectedUserEmail}
            >
              <SelectTrigger className="w-[180px] bg-slate-800 border-slate-700 text-white text-xs h-9">
                <Users className="h-3 w-3 mr-2" />
                <SelectValue placeholder="Pilih Dashboard" />
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
            <Button variant="ghost" size="icon" onClick={handleLogout}>
              <LogOut className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <SummaryCard
            title="Sisa Uang"
            amount={sisaUang}
            icon={<Wallet className="h-5 w-5 text-indigo-400" />}
            className="border-indigo-500/20 bg-indigo-500/5"
          />
          <SummaryCard
            title="Uang Masuk"
            amount={totalMasuk}
            icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
            className="border-emerald-500/20 bg-emerald-500/5"
          />
          <SummaryCard
            title="Uang Keluar"
            amount={totalKeluar}
            icon={<TrendingDown className="h-5 w-5 text-rose-400" />}
            className="border-rose-500/20 bg-rose-500/5"
          />
        </div>

        <div className="grid gap-8 lg:grid-cols-12">
          {isViewingOwnDashboard && (
            <Card className="lg:col-span-4 bg-slate-900 border-slate-800">
              <CardHeader>
                <CardTitle className="text-xl text-white">
                  {editingId ? "Update Transaksi" : "Tambah Transaksi"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <Input
                    required
                    placeholder="Keterangan Masuk/Keluar Uang"
                    value={nama}
                    onChange={(e) => setNama(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  <Input
                    required
                    type="number"
                    placeholder="Jumlah Uang"
                    value={jumlah}
                    onChange={(e) => setJumlah(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  <Select
                    value={tipe}
                    onValueChange={(val: "masuk" | "keluar") => setTipe(val)}
                  >
                    <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-slate-800 border-slate-700 text-white">
                      <SelectItem value="masuk">Uang Masuk</SelectItem>
                      <SelectItem value="keluar">Uang Keluar</SelectItem>
                    </SelectContent>
                  </Select>
                  <Input
                    required
                    placeholder="Kategori Transaksi : Makanan, Transportasi, Gaji, dll"
                    value={kategori}
                    onChange={(e) => setKategori(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  <Input
                    required
                    type="date"
                    value={tanggal}
                    onChange={(e) => setTanggal(e.target.value)}
                    className="bg-slate-800 border-slate-700 text-white"
                  />
                  <Button type="submit" className="w-full bg-indigo-600">
                    {editingId ? "Update" : "Simpan"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          )}

          <Card
            className={`${isViewingOwnDashboard ? "lg:col-span-8" : "lg:col-span-12"} bg-slate-900 border-slate-800 overflow-hidden`}
          >
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <CardTitle className="text-xl text-white">
                Riwayat Transaksi
              </CardTitle>
              <div className="flex gap-2">
                <Select
                  value={filterType}
                  onValueChange={(val: any) => setFilterType(val)}
                >
                  <SelectTrigger className="w-[120px] bg-slate-800 border-slate-700 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700 text-white">
                    <SelectItem value="all">Semua</SelectItem>
                    <SelectItem value="today">Hari Ini</SelectItem>
                    <SelectItem value="yesterday">Kemarin</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
                {filterType === "custom" && (
                  <Input
                    type="date"
                    value={customDate}
                    onChange={(e) => setCustomDate(e.target.value)}
                    className="w-[150px] bg-slate-800 border-slate-700 text-white"
                  />
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader className="bg-slate-800/50">
                  <TableRow className="border-slate-800 hover:bg-transparent">
                    <TableHead className="text-slate-400">Tanggal</TableHead>
                    <TableHead className="text-slate-400">Keterangan</TableHead>
                    <TableHead className="text-slate-400">Kategori</TableHead>
                    <TableHead className="text-right text-slate-400">
                      Jumlah
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id} className="border-slate-800">
                      <TableCell className="text-slate-200">
                        {new Date(t.tanggal).toLocaleDateString("id-ID")}
                      </TableCell>
                      <TableCell className="text-slate-200">{t.nama}</TableCell>
                      <TableCell className="text-slate-400 text-sm">
                        {t.kategori}
                      </TableCell>
                      <TableCell
                        className={`text-right font-medium ${t.tipe === "masuk" ? "text-emerald-400" : "text-rose-400"}`}
                      >
                        {t.tipe === "masuk" ? "+" : "-"}
                        {new Intl.NumberFormat("id-ID", {
                          style: "currency",
                          currency: "IDR",
                        }).format(t.jumlah)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ title, amount, icon, className }: any) {
  return (
    <Card className={`bg-slate-900 border-slate-800 ${className}`}>
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-400">{title}</p>
            <p className="text-2xl font-bold text-white">
              {new Intl.NumberFormat("id-ID", {
                style: "currency",
                currency: "IDR",
              }).format(amount)}
            </p>
          </div>
          {icon}
        </div>
      </CardContent>
    </Card>
  );
}
