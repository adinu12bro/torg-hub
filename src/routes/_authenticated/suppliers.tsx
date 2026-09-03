import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus, Search } from "lucide-react";
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
import { supabase } from "@/integrations/supabase/client";
import { EmptyState, Loading, PageHeader, SectionCard } from "@/components/erp/ui";
import { money, num } from "@/lib/erp";

export const Route = createFileRoute("/_authenticated/suppliers")({
  head: () => ({
    meta: [
      { title: "Suppliers — TORG Wholesale" },
      { name: "description", content: "Supplier directory with purchase totals and contacts." },
      { property: "og:title", content: "Suppliers — TORG Wholesale" },
      { property: "og:description", content: "Manage vendors and purchase relationships." },
    ],
  }),
  component: Suppliers,
});

type Draft = {
  id?: string;
  name: string;
  contact_person: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  city: string;
  state: string;
  country: string;
  notes: string;
  is_active: boolean;
};

const emptyDraft: Draft = {
  name: "",
  contact_person: "",
  phone: "",
  whatsapp: "",
  email: "",
  address: "",
  city: "",
  state: "",
  country: "India",
  notes: "",
  is_active: true,
};

function Suppliers() {
  const qc = useQueryClient();
  const [term, setTerm] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);

  const suppliersQ = useQuery({
    queryKey: ["suppliers"],
    queryFn: async () => {
      const { data, error } = await supabase.from("suppliers").select("*").order("name");
      if (error) throw error;
      return data;
    },
  });

  const purchasesQ = useQuery({
    queryKey: ["supplier-totals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("purchases")
        .select("supplier_id, total_cost")
        .eq("status", "confirmed");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const p of data) {
        if (!p.supplier_id) continue;
        map.set(p.supplier_id, (map.get(p.supplier_id) ?? 0) + num(p.total_cost));
      }
      return map;
    },
  });

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (suppliersQ.data ?? []).filter(
      (s) =>
        !t ||
        [s.name, s.contact_person, s.phone, s.city].filter(Boolean).some((f) =>
          f!.toLowerCase().includes(t),
        ),
    );
  }, [suppliersQ.data, term]);

  const save = useMutation({
    mutationFn: async (d: Draft) => {
      if (!d.name.trim()) throw new Error("Supplier name is required");
      const payload = {
        name: d.name.trim(),
        contact_person: d.contact_person.trim() || null,
        phone: d.phone.trim() || null,
        whatsapp: d.whatsapp.trim() || null,
        email: d.email.trim() || null,
        address: d.address.trim() || null,
        city: d.city.trim() || null,
        state: d.state.trim() || null,
        country: d.country.trim() || null,
        notes: d.notes.trim() || null,
        is_active: d.is_active,
      };
      if (d.id) {
        const { error } = await supabase.from("suppliers").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("suppliers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Supplier saved");
      qc.invalidateQueries();
      setDraft(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save supplier"),
  });

  return (
    <div>
      <PageHeader
        title="Suppliers"
        description="Vendor directory and purchase totals."
        actions={
          <Button
            onClick={() => {
              setDraft({ ...emptyDraft });
            }}
          >
            <Plus className="mr-2 h-4 w-4" aria-hidden />
            New supplier
          </Button>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="relative max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            placeholder="Search name, contact, city…"
            className="pl-9"
          />
        </div>

        <SectionCard title={`${rows.length} supplier${rows.length === 1 ? "" : "s"}`}>
          {suppliersQ.isLoading ? (
            <Loading />
          ) : rows.length === 0 ? (
            <EmptyState title="No suppliers yet" hint="Add the vendors you buy stock from." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2">Supplier</th>
                    <th>Contact</th>
                    <th>Location</th>
                    <th className="text-right">Total purchased</th>
                    <th className="text-right">Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="py-2 font-medium">{s.name}</td>
                      <td className="text-xs text-muted-foreground">
                        {[s.contact_person, s.phone].filter(Boolean).join(" · ") || "—"}
                      </td>
                      <td className="text-xs text-muted-foreground">
                        {[s.city, s.state].filter(Boolean).join(", ") || "—"}
                      </td>
                      <td className="num text-right">{money(purchasesQ.data?.get(s.id) ?? 0)}</td>
                      <td className="text-right">
                        <Badge variant={s.is_active ? "secondary" : "outline"}>
                          {s.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="text-right">
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={() =>
                            setDraft({
                              id: s.id,
                              name: s.name,
                              contact_person: s.contact_person ?? "",
                              phone: s.phone ?? "",
                              whatsapp: s.whatsapp ?? "",
                              email: s.email ?? "",
                              address: s.address ?? "",
                              city: s.city ?? "",
                              state: s.state ?? "",
                              country: s.country ?? "India",
                              notes: s.notes ?? "",
                              is_active: s.is_active,
                            })
                          }
                        >
                          <Pencil className="h-4 w-4" aria-hidden />
                          <span className="sr-only">Edit</span>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </SectionCard>
      </div>

      <Dialog open={!!draft} onOpenChange={(o) => !o && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit supplier" : "New supplier"}</DialogTitle>
          </DialogHeader>
          {draft ? (
            <div className="grid gap-3 sm:grid-cols-2">
              {(
                [
                  ["name", "Supplier name *"],
                  ["contact_person", "Contact person"],
                  ["phone", "Phone"],
                  ["whatsapp", "WhatsApp"],
                  ["email", "Email"],
                  ["city", "City"],
                  ["state", "State"],
                  ["country", "Country"],
                ] as const
              ).map(([key, label]) => (
                <div className="grid gap-1.5" key={key}>
                  <Label htmlFor={key}>{label}</Label>
                  <Input
                    id={key}
                    value={draft[key] as string}
                    onChange={(e) => setDraft({ ...draft, [key]: e.target.value })}
                  />
                </div>
              ))}
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="saddress">Address</Label>
                <Input
                  id="saddress"
                  value={draft.address}
                  onChange={(e) => setDraft({ ...draft, address: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5 sm:col-span-2">
                <Label htmlFor="snotes">Notes</Label>
                <Textarea
                  id="snotes"
                  rows={2}
                  value={draft.notes}
                  onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 text-sm sm:col-span-2">
                <input
                  type="checkbox"
                  checked={draft.is_active}
                  onChange={(e) => setDraft({ ...draft, is_active: e.target.checked })}
                  className="h-4 w-4"
                />
                Active supplier
              </label>
            </div>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button disabled={save.isPending} onClick={() => draft && save.mutate(draft)}>
              {save.isPending ? "Saving…" : "Save supplier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
