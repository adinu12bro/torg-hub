import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, Loading, PageHeader, SectionCard, StatCard } from "@/components/erp/ui";
import { dateOnly, EXPENSE_CATEGORIES, formatDate, money, num, PAYMENT_METHODS } from "@/lib/erp";

export const Route = createFileRoute("/_authenticated/expenses")({
  head: () => ({
    meta: [
      { title: "Expenses — TORG Wholesale" },
      { name: "description", content: "Track business expenses by category and date." },
      { property: "og:title", content: "Expenses — TORG Wholesale" },
      { property: "og:description", content: "Record and review operating expenses." },
    ],
  }),
  component: Expenses,
});

function Expenses() {
  const qc = useQueryClient();
  const [category, setCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [amount, setAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(dateOnly(new Date()));
  const [method, setMethod] = useState<string>("Cash");
  const [description, setDescription] = useState("");
  const [filterCat, setFilterCat] = useState("all");

  const expensesQ = useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .order("expense_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(
    () =>
      (expensesQ.data ?? []).filter(
        (e) => filterCat === "all" || e.category === filterCat,
      ),
    [expensesQ.data, filterCat],
  );

  const total = rows.reduce((s, e) => s + num(e.amount), 0);
  const thisMonth = (expensesQ.data ?? [])
    .filter((e) => e.expense_date.slice(0, 7) === dateOnly(new Date()).slice(0, 7))
    .reduce((s, e) => s + num(e.amount), 0);
  const byCat = new Map<string, number>();
  for (const e of expensesQ.data ?? []) byCat.set(e.category, (byCat.get(e.category) ?? 0) + num(e.amount));
  const topCat = [...byCat.entries()].sort((a, b) => b[1] - a[1])[0];

  const add = useMutation({
    mutationFn: async () => {
      if (num(amount) <= 0) throw new Error("Enter an amount");
      const { error } = await supabase.from("expenses").insert({
        category: category!,
        amount: num(amount),
        expense_date: expenseDate,
        payment_method: method,
        description: description.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense recorded");
      setAmount("");
      setDescription("");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not record expense"),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Expense deleted");
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  return (
    <div>
      <PageHeader title="Expenses" description="Operating costs that reduce net profit." />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Filtered total" value={money(total)} />
          <StatCard label="This month" value={money(thisMonth)} />
          <StatCard
            label="Top category"
            value={topCat ? topCat[0] : "—"}
            hint={topCat ? money(topCat[1]) : undefined}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <SectionCard title="Record an expense">
            <div className="space-y-3">
              <div className="grid gap-1.5">
                <Label htmlFor="ecat">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="ecat">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {EXPENSE_CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="eamount">Amount (₹)</Label>
                <Input
                  id="eamount"
                  className="num"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edate">Date</Label>
                <Input
                  id="edate"
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="emethod">Paid via</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger id="emethod">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edesc">Description</Label>
                <Input
                  id="edesc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <Button className="w-full" disabled={add.isPending} onClick={() => add.mutate()}>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                {add.isPending ? "Saving…" : "Add expense"}
              </Button>
            </div>
          </SectionCard>

          <SectionCard
            title="Expense log"
            actions={
              <Select value={filterCat} onValueChange={setFilterCat}>
                <SelectTrigger className="w-36">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {EXPENSE_CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            }
          >
            {expensesQ.isLoading ? (
              <Loading />
            ) : rows.length === 0 ? (
              <EmptyState title="No expenses recorded" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs uppercase text-muted-foreground">
                      <th className="py-2">Date</th>
                      <th>Category</th>
                      <th>Description</th>
                      <th>Method</th>
                      <th className="text-right">Amount</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((e) => (
                      <tr key={e.id} className="border-t">
                        <td className="py-2 text-xs text-muted-foreground">
                          {formatDate(e.expense_date)}
                        </td>
                        <td>{e.category}</td>
                        <td className="text-xs text-muted-foreground">{e.description ?? "—"}</td>
                        <td className="text-xs">{e.payment_method}</td>
                        <td className="num text-right font-medium">{money(e.amount)}</td>
                        <td className="text-right">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button size="icon" variant="ghost">
                                <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                                <span className="sr-only">Delete</span>
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete expense?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {money(e.amount)} on {formatDate(e.expense_date)} ({e.category}).
                                  This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Keep</AlertDialogCancel>
                                <AlertDialogAction onClick={() => remove.mutate(e.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
