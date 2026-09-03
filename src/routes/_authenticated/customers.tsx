import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Pencil, Plus, Search } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, Loading, PageHeader, SectionCard, StatCard } from "@/components/erp/ui";
import { downloadCsv, money, num } from "@/lib/erp";

export const Route = createFileRoute("/_authenticated/customers")({
  head: () => ({
    meta: [
      { title: "Customers — TORG Wholesale" },
      { name: "description", content: "Customer CRM: contacts, credit limits, balances and history." },
      { property: "og:title", content: "Customers — TORG Wholesale" },
      { property: "og:description", content: "Manage wholesale customer relationships and credit." },
    ],
  }),
  component: Customers,
});

type Draft = {
  id?: string;
  name: string;
  shop_name: string;
  phone: string;
  whatsapp: string;
  email: string;
  instagram: string;
  address: string;
  city: string;
  state: string;
  country: string;
  notes: string;
  credit_limit: string;
  status: string;
};

const emptyDraft: Draft = {
  name: "",
  shop_name: "",
  phone: "",
  whatsapp: "",
  email: "",
  instagram: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  notes: "",
  credit_limit: "0",
  status: "active",
};

function Customers() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [status, setStatus] = useState("active");
  const [draft, setDraft] = useState<Draft | null>(null);

  const customersQ = useQuery({
    queryKey: ["customers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const balancesQ = useQuery({
    queryKey: ["customer-balances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("customer_id, balance, revenue")
        .eq("status", "completed");
      if (error) throw error;
      const map = new Map<string, { balance: number; revenue: number }>();
      for (const s of data) {
        if (!s.customer_id) continue;
        const cur = map.get(s.customer_id) ?? { balance: 0, revenue: 0 };
        cur.balance += num(s.balance);
        cur.revenue += num(s.revenue);
        map.set(s.customer_id, cur);
      }
      return map;
    },
  });

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (customersQ.data ?? []).filter((c) => {
      if (status !== "all" && c.status !== status) return false;
      if (!t) return true;
      return [c.name, c.shop_name, c.phone, c.city, c.email]
        .filter(Boolean)
        .some((f) => f!.toLowerCase().includes(t));
    });
  }, [customersQ.data, term, status]);

  const totalOutstanding = [...(balancesQ.data?.values() ?? [])].reduce((s, b) => s + b.balance, 0);
  const overLimit = (customersQ.data ?? []).filter(
    (c) => num(balancesQ.data?.get(c.id)?.balance) > num(c.credit_limit) && num(c.credit_limit) > 0,
  );

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      if (!d.name.trim()) throw new Error("Customer name is required");
      const payload = {
        name: d.name.trim(),
        shop_name: d.shop_name.trim() || null,
        phone: d.phone.trim() || null,
        whatsapp: d.whatsapp.trim() || null,
        email: d.email.trim() || null,
        instagram: d.instagram.trim() || null,
        address: d.address.trim() || null,
        city: d.city.trim() || null,
        state: d.state.trim() || null,
        country: d.country.trim() || null,
        notes: d.notes.trim() || null,
        credit_limit: num(d.credit_limit),
        status: d.status as "active" | "inactive" | "blocked",
      };
      if (d.id) {
        const { error } = await supabase.from("customers").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("customers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Customer saved");
      qc.invalidateQueries();
      setDraft(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save customer"),
  });

  return (
    <div>
      <PageHeader
        title="Customers"
        description="Contacts, credit limits and outstanding balances."
        actions={
          <>
            <Button
              variant="outline"
              onClick={() =>
                downloadCsv(
                  "torg-customers.csv",
                  rows.map((c) => ({
                    name: c.name,
                    shop: c.shop_name ?? "",
                    phone: c.phone ?? "",
                    city: c.city ?? "",
                    credit_limit: c.credit_limit,
                    balance: balancesQ.data?.get(c.id)?.balance ?? 0,
                    status: c.status,
                  })),
                )
              }
            >
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Export
            </Button>
            <Button
              onClick={() => {
                setDraft({ ...emptyDraft });
              }}
            >
              <Plus className="mr-2 h-4 w-4" aria-hidden />
              New customer
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <StatCard label="Customers" value={customersQ.data?.length ?? 0} />
          <StatCard
            label="Total outstanding"
            value={money(totalOutstanding)}
            tone={totalOutstanding > 0 ? "negative" : "default"}
          />
          <StatCard
            label="Over credit limit"
            value={overLimit.length}
            tone={overLimit.length > 0 ? "negative" : "default"}
          />
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search name, shop, phone, city…"
              className="pl-9"
            />
          </div>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="blocked">Blocked</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SectionCard title={`${rows.length} customer${rows.length === 1 ? "" : "s"}`}>
          {customersQ.isLoading ? (
            <Loading />
          ) : rows.length === 0 ? (
            <EmptyState title="No customers yet" hint="Add your first wholesale buyer." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2">Customer</th>
                    <th>Contact</th>
                    <th className="text-right">Lifetime sales</th>
                    <th className="text-right">Balance</th>
                    <th className="text-right">Credit limit</th>
                    <th className="text-right">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((c) => {
                    const bal = balancesQ.data?.get(c.id);
                    const over = num(bal?.balance) > num(c.credit_limit) && num(c.credit_limit) > 0;
                    return (
                      <tr key={c.id} className="border-t">
                        <td className="py-2">
                          <p className="font-medium">{c.shop_name || c.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.shop_name ? c.name : ""} {c.city ? `· ${c.city}` : ""}
                          </p>
                        </td>
                        <td className="text-xs text-muted-foreground">
                          {c.phone ?? "—"}
                          {c.whatsapp ? <span> · WA {c.whatsapp}</span> : null}
                        </td>
                        <td className="num text-right">{money(bal?.revenue ?? 0)}</td>
                        <td className={`num text-right font-medium ${over ? "text-destructive" : ""}`}>
                          {money(bal?.balance ?? 0)}
                        </td>
                        <td className="num text-right text-muted-foreground">{money(c.credit_limit)}</td>
                        <td className="text-right">
                          <Badge
                            variant={c.status === "active" ? "secondary" : c.status === "blocked" ? "destructive" : "outline"}
                          >
                            {c.status}
                          </Badge>
                        </td>
                        <td className="text-right">
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() =>
                              setDraft({
                                id: c.id,
                                name: c.name,
                                shop_name: c.shop_name ?? "",
                                phone: c.phone ?? "",
                                whatsapp: c.whatsapp ?? "",
                                email: c.email ?? "",
                                instagram: c.instagram ?? "",
                                address: c.address ?? "",
                                city: c.city ?? "",
                                state: c.state ?? "",
                                country: c.country ?? "India",
                                notes: c.notes ?? "",
                                credit_limit: String(c.credit_limit),
                                status: c.status,
                              })
                            }
                          >
                            <Pencil className="h-4 w-4" aria-hidden />
                            <span className="sr-only">Edit</span>
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit customer" : "New customer"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["name", "Contact name *"],
                  ["shop_name", "Shop / business"],
                  ["phone", "Phone"],
                  ["whatsapp", "WhatsApp"],
                  ["email", "Email"],
                  ["instagram", "Instagram"],
                  ["city", "City"],
                  ["state", "State"],
                  ["country", "Country"],
                  ["credit_limit", "Credit limit (₹)"],
                ] as const
              ).map(([key, label]) => (
                <div className="grid gap-1.5" key={key}>
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    className={key === "credit_limit" ? "num" : ""}
                    value={draft[key]}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div className="grid gap-1.5">
                <Label htmlFor="cstatus">Status</Label>
                <Select
                  value={draft.status}
                  onValueChange={(v) => setDraft({ ...draft, status: v })}
                >
                  <SelectTrigger id="cstatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="blocked">Blocked</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="cnotes">Notes</Label>
                <Textarea
                  id="cnotes"
                  rows={2}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </div>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => draft && save.mutate(draft)}>
              {save.isPending ? "Saving…" : "Save customer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
