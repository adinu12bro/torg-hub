import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, History, Search, SlidersHorizontal } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { useCurrentUser } from "@/hooks/use-session";
import { EmptyState, Loading, PageHeader, SectionCard, StatCard } from "@/components/erp/ui";
import { ScanButton } from "@/components/erp/BarcodeScanner";
import { downloadCsv, formatDateTime, money, num, variantLabel } from "@/lib/erp";

export const Route = createFileRoute("/_authenticated/inventory")({
  head: () => ({
    meta: [
      { title: "Inventory — TORG Wholesale" },
      {
        name: "description",
        content: "Stock on hand, low-stock alerts, adjustments and the full movement ledger.",
      },
      { property: "og:title", content: "Inventory — TORG Wholesale" },
      { property: "og:description", content: "Track every unit with a full audit trail." },
    ],
  }),
  component: Inventory,
});

type Filter = "all" | "low" | "out" | "in";

function Inventory() {
  const qc = useQueryClient();
  const { canSeeCost, can } = useCurrentUser();
  const canAdjust = can("manager");
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [target, setTarget] = useState<{ id: string; name: string; stock: number } | null>(null);
  const [qty, setQty] = useState("1");
  const [type, setType] = useState("receive");
  const [reason, setReason] = useState("");

  const stockQ = useQuery({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select(
          "id, sku, barcode, color, size, stock, min_stock, buy_price, selling_price, is_active, products!inner(id, name, brand, min_stock, buy_price, selling_price, status, suppliers(name), categories:category_id(name))",
        )
        .eq("is_active", true)
        .order("stock", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const movementsQ = useQuery({
    queryKey: ["movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select(
          "id, previous_qty, qty_change, new_qty, movement_type, reason, unit_cost, created_at, products(name), product_variants(sku, color, size), profiles:user_id(full_name)",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (stockQ.data ?? []).filter((v) => {
      const min = v.min_stock ?? v.products?.min_stock ?? 0;
      if (filter === "low" && !(v.stock > 0 && v.stock <= min)) return false;
      if (filter === "out" && v.stock > 0) return false;
      if (filter === "in" && v.stock <= 0) return false;
      if (!t) return true;
      return (
        (v.products?.name ?? "").toLowerCase().includes(t) ||
        v.sku.toLowerCase().includes(t) ||
        (v.barcode ?? "").toLowerCase().includes(t) ||
        variantLabel(v).toLowerCase().includes(t)
      );
    });
  }, [stockQ.data, term, filter]);

  const all = stockQ.data ?? [];
  const totalUnits = all.reduce((s, v) => s + v.stock, 0);
  const stockValue = all.reduce(
    (s, v) => s + v.stock * num(v.buy_price ?? v.products?.buy_price),
    0,
  );
  const lowCount = all.filter((v) => {
    const min = v.min_stock ?? v.products?.min_stock ?? 0;
    return v.stock > 0 && v.stock <= min;
  }).length;
  const outCount = all.filter((v) => v.stock <= 0).length;

  const adjust = useMutation({
    mutationFn: async () => {
      if (!target) throw new Error("No variant selected");
      const n = Math.trunc(num(qty));
      if (n === 0) throw new Error("Quantity must not be zero");
      if (!reason.trim()) throw new Error("A reason is required");
      const signed =
        type === "adjustment" ? n : type === "receive" || type === "return" ? Math.abs(n) : -Math.abs(n);
      const { error } = await supabase.rpc("adjust_stock", {
        _variant_id: target.id,
        _qty_change: signed,
        _type: type as "receive" | "adjustment" | "damage" | "loss" | "return",
        _reason: reason.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Stock adjusted");
      qc.invalidateQueries();
      setTarget(null);
      setQty("1");
      setReason("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Adjustment failed"),
  });

  function exportCsv() {
    downloadCsv(
      "torg-inventory.csv",
      rows.map((v) => ({
        product: v.products?.name ?? "",
        variant: variantLabel(v),
        sku: v.sku,
        barcode: v.barcode ?? "",
        supplier: v.products?.suppliers?.name ?? "",
        stock: v.stock,
        min_stock: v.min_stock ?? v.products?.min_stock ?? 0,
        stock_value: canSeeCost ? v.stock * num(v.buy_price ?? v.products?.buy_price) : "",
      })),
    );
  }

  return (
    <div>
      <PageHeader
        title="Inventory"
        description="Live stock levels, adjustments and full movement history."
        actions={
          <>
            <ScanButton onDetected={(c) => setTerm(c)} />
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Export
            </Button>
          </>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Units on hand" value={totalUnits} />
          <StatCard
            label="Stock value"
            value={canSeeCost ? money(stockValue) : "—"}
            hint={canSeeCost ? undefined : "Manager access required"}
          />
          <StatCard label="Low stock" value={lowCount} tone={lowCount ? "negative" : "default"} />
          <StatCard label="Out of stock" value={outCount} tone={outCount ? "negative" : "default"} />
        </div>

        <Tabs defaultValue="stock">
          <TabsList>
            <TabsTrigger value="stock">
              <SlidersHorizontal className="mr-2 h-4 w-4" aria-hidden />
              Stock
            </TabsTrigger>
            <TabsTrigger value="ledger">
              <History className="mr-2 h-4 w-4" aria-hidden />
              Movements
            </TabsTrigger>
          </TabsList>

          <TabsContent value="stock" className="space-y-3 pt-4">
            <div className="flex flex-wrap gap-2">
              <div className="relative min-w-56 flex-1">
                <Search
                  className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  placeholder="Search product, SKU or barcode…"
                  className="pl-9"
                />
              </div>
              <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All variants</SelectItem>
                  <SelectItem value="in">In stock</SelectItem>
                  <SelectItem value="low">Low stock</SelectItem>
                  <SelectItem value="out">Out of stock</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <SectionCard title={`${rows.length} variant${rows.length === 1 ? "" : "s"}`}>
              {stockQ.isLoading ? (
                <Loading />
              ) : rows.length === 0 ? (
                <EmptyState title="Nothing matches" hint="Try a different search or filter." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground">
                        <th className="py-2">Product</th>
                        <th>SKU / barcode</th>
                        <th className="text-right">On hand</th>
                        <th className="text-right">Min</th>
                        {canSeeCost ? <th className="text-right">Value</th> : null}
                        <th className="text-right">Status</th>
                        {canAdjust ? <th /> : null}
                      </tr>
                    </thead>
                    <tbody>
                      {rows.map((v) => {
                        const min = v.min_stock ?? v.products?.min_stock ?? 0;
                        const low = v.stock > 0 && v.stock <= min;
                        return (
                          <tr key={v.id} className="border-t">
                            <td className="py-2">
                              <p className="font-medium">{v.products?.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {[variantLabel(v), v.products?.suppliers?.name]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </p>
                            </td>
                            <td className="num text-xs text-muted-foreground">
                              {v.sku}
                              {v.barcode ? ` · ${v.barcode}` : ""}
                            </td>
                            <td className="num text-right font-semibold">{v.stock}</td>
                            <td className="num text-right text-muted-foreground">{min}</td>
                            {canSeeCost ? (
                              <td className="num text-right">
                                {money(v.stock * num(v.buy_price ?? v.products?.buy_price))}
                              </td>
                            ) : null}
                            <td className="text-right">
                              {v.stock <= 0 ? (
                                <Badge variant="destructive">Out</Badge>
                              ) : low ? (
                                <Badge variant="outline" className="border-warning text-warning">
                                  Low
                                </Badge>
                              ) : (
                                <Badge variant="secondary">OK</Badge>
                              )}
                            </td>
                            {canAdjust ? (
                              <td className="text-right">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() =>
                                    setTarget({
                                      id: v.id,
                                      name: `${v.products?.name} ${variantLabel(v)}`.trim(),
                                      stock: v.stock,
                                    })
                                  }
                                >
                                  Adjust
                                </Button>
                              </td>
                            ) : null}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="ledger" className="pt-4">
            <SectionCard title="Movement ledger (last 200)">
              {movementsQ.isLoading ? (
                <Loading />
              ) : (movementsQ.data ?? []).length === 0 ? (
                <EmptyState title="No movements recorded yet" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-xs uppercase text-muted-foreground">
                        <th className="py-2">When</th>
                        <th>Product</th>
                        <th>Type</th>
                        <th className="text-right">Change</th>
                        <th className="text-right">After</th>
                        <th>Reason</th>
                        <th>By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(movementsQ.data ?? []).map((m) => (
                        <tr key={m.id} className="border-t">
                          <td className="py-2 text-xs text-muted-foreground">
                            {formatDateTime(m.created_at)}
                          </td>
                          <td>
                            {m.products?.name}
                            <span className="ml-1 text-xs text-muted-foreground">
                              {m.product_variants ? variantLabel(m.product_variants) : ""}
                            </span>
                          </td>
                          <td>
                            <Badge variant="outline">{m.movement_type}</Badge>
                          </td>
                          <td
                            className={`num text-right font-medium ${m.qty_change >= 0 ? "text-success" : "text-destructive"}`}
                          >
                            {m.qty_change > 0 ? "+" : ""}
                            {m.qty_change}
                          </td>
                          <td className="num text-right">{m.new_qty}</td>
                          <td className="text-xs text-muted-foreground">{m.reason ?? "—"}</td>
                          <td className="text-xs text-muted-foreground">
                            {m.profiles?.full_name || "System"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </SectionCard>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={!!target} onOpenChange={(o) => !o && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adjust stock</DialogTitle>
            <DialogDescription>
              {target?.name} · currently {target?.stock} on hand. Every adjustment is logged.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid gap-1.5">
              <Label htmlFor="mtype">Movement type</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger id="mtype">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="receive">Receive (+)</SelectItem>
                  <SelectItem value="return">Return (+)</SelectItem>
                  <SelectItem value="damage">Damage (−)</SelectItem>
                  <SelectItem value="loss">Loss (−)</SelectItem>
                  <SelectItem value="adjustment">Manual (± value)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mqty">Quantity</Label>
              <Input id="mqty" className="num" value={qty} onChange={(e) => setQty(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="mreason">Reason (required)</Label>
              <Input
                id="mreason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. stock received from supplier"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button disabled={adjust.isPending} onClick={() => adjust.mutate()}>
              {adjust.isPending ? "Applying…" : "Apply"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
