import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Minus, Plus, Printer, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-session";
import { EmptyState, PageHeader, SectionCard } from "@/components/erp/ui";
import { ScanButton, useHardwareScanner } from "@/components/erp/BarcodeScanner";
import { costOf, findByCode, priceOf, searchVariants, wholesaleOf } from "@/lib/catalog";
import { money, num, PAYMENT_METHODS, printReport, variantLabel } from "@/lib/erp";

export const Route = createFileRoute("/_authenticated/pos")({
  head: () => ({
    meta: [
      { title: "POS — TORG Wholesale" },
      { name: "description", content: "Barcode-first point of sale with credit, discounts and instant receipts." },
      { property: "og:title", content: "POS — TORG Wholesale" },
      { property: "og:description", content: "Scan, sell and settle payments in seconds." },
    ],
  }),
  component: Pos,
});

type Line = {
  variantId: string;
  productName: string;
  label: string;
  sku: string;
  unitPrice: number;
  unitCost: number;
  wholesale: number;
  retail: number;
  quantity: number;
  discount: number;
  stock: number;
};

function Pos() {
  const qc = useQueryClient();
  const { canSeeCost } = useCurrentUser();
  const [term, setTerm] = useState("");
  const [lines, setLines] = useState<Line[]>([]);
  const [customerId, setCustomerId] = useState<string>("walkin");
  const [walkInName, setWalkInName] = useState("");
  const [orderDiscount, setOrderDiscount] = useState("");
  const [method, setMethod] = useState<string>("Cash");
  const [tendered, setTendered] = useState("");
  const [reference, setReference] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [priceMode, setPriceMode] = useState<"retail" | "wholesale">("retail");
  const searchRef = useRef<HTMLInputElement>(null);

  const customersQ = useQuery({
    queryKey: ["pos-customers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, name, shop_name, phone, status, credit_limit")
        .neq("status", "blocked")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const resultsQ = useQuery({
    queryKey: ["pos-search", term],
    queryFn: () => searchVariants(term),
  });

  const addVariant = useCallback(
    (v: Awaited<ReturnType<typeof searchVariants>>[number], mode: "retail" | "wholesale") => {
      const retail = priceOf(v);
      const wholesale = wholesaleOf(v) || retail;
      setLines((prev) => {
        const existing = prev.find((l) => l.variantId === v.id);
        if (existing) {
          return prev.map((l) =>
            l.variantId === v.id ? { ...l, quantity: l.quantity + 1 } : l,
          );
        }
        return [
          ...prev,
          {
            variantId: v.id,
            productName: v.products?.name ?? "Product",
            label: variantLabel(v),
            sku: v.sku,
            unitPrice: mode === "wholesale" ? wholesale : retail,
            unitCost: costOf(v),
            wholesale,
            retail,
            quantity: 1,
            discount: 0,
            stock: v.stock,
          },
        ];
      });
    },
    [],
  );

  const handleCode = useCallback(
    async (code: string) => {
      try {
        const v = await findByCode(code);
        if (!v) {
          toast.error(`No product for code ${code}`);
          return;
        }
        addVariant(v as Awaited<ReturnType<typeof searchVariants>>[number], priceMode);
        toast.success(`${v.products?.name} added`);
        setTerm("");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Lookup failed");
      }
    },
    [addVariant, priceMode],
  );

  useHardwareScanner(handleCode);

  useEffect(() => {
    searchRef.current?.focus();
  }, []);

  const setLine = (id: string, patch: Partial<Line>) =>
    setLines((prev) => prev.map((l) => (l.variantId === id ? { ...l, ...patch } : l)));
  const removeLine = (id: string) => setLines((prev) => prev.filter((l) => l.variantId !== id));

  const subtotal = lines.reduce((s, l) => s + l.unitPrice * l.quantity - l.discount, 0);
  const costTotal = lines.reduce((s, l) => s + l.unitCost * l.quantity, 0);
  const discount = Math.max(num(orderDiscount), 0);
  const total = Math.max(subtotal - discount, 0);
  const paid = Math.min(Math.max(num(tendered), 0), total);
  const balance = total - paid;
  const profit = total - costTotal;
  const change = Math.max(num(tendered) - total, 0);

  const selectedCustomer = useMemo(
    () => (customersQ.data ?? []).find((c) => c.id === customerId),
    [customersQ.data, customerId],
  );

  const checkout = useMutation({
    mutationFn: async () => {
      if (lines.length === 0) throw new Error("Cart is empty");
      if (balance > 0 && customerId === "walkin")
        throw new Error("Select a customer to sell on credit");
      const payload = {
        idempotency_key: crypto.randomUUID(),
        customer_id: customerId === "walkin" ? null : customerId,
        customer_name:
          customerId === "walkin"
            ? walkInName || "Walk-in"
            : selectedCustomer?.shop_name || selectedCustomer?.name,
        discount,
        notes,
        due_date: balance > 0 ? dueDate || null : null,
        is_credit: balance > 0,
        items: lines.map((l) => ({
          variant_id: l.variantId,
          quantity: l.quantity,
          unit_price: l.unitPrice,
          discount: l.discount,
        })),
        payments: paid > 0 ? [{ amount: paid, method, reference }] : [],
      };
      const { data, error } = await supabase.rpc("complete_sale", { _payload: payload });
      if (error) throw error;
      return data as string;
    },
    onSuccess: async (saleId) => {
      toast.success("Sale completed");
      const receipt = buildReceipt();
      qc.invalidateQueries();
      setLines([]);
      setOrderDiscount("");
      setTendered("");
      setReference("");
      setNotes("");
      setDueDate("");
      setWalkInName("");
      setCustomerId("walkin");
      searchRef.current?.focus();
      lastSale.current = { id: saleId, html: receipt };
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not complete sale"),
  });

  const lastSale = useRef<{ id: string; html: string } | null>(null);

  function buildReceipt() {
    const rows = lines
      .map(
        (l) =>
          `<tr><td>${l.productName}${l.label ? ` (${l.label})` : ""}</td><td style="text-align:right">${l.quantity}</td><td style="text-align:right">${money(l.unitPrice)}</td><td style="text-align:right">${money(l.unitPrice * l.quantity - l.discount)}</td></tr>`,
      )
      .join("");
    return `
      <h2>TORG Wholesale</h2>
      <p>${new Date().toLocaleString()}</p>
      <p>Customer: ${customerId === "walkin" ? walkInName || "Walk-in" : selectedCustomer?.shop_name || selectedCustomer?.name}</p>
      <table style="width:100%;border-collapse:collapse" border="0">
        <thead><tr><th align="left">Item</th><th align="right">Qty</th><th align="right">Price</th><th align="right">Total</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <hr/>
      <p style="text-align:right">Subtotal: ${money(subtotal)}</p>
      <p style="text-align:right">Discount: ${money(discount)}</p>
      <p style="text-align:right"><strong>Total: ${money(total)}</strong></p>
      <p style="text-align:right">Paid: ${money(paid)} (${method})</p>
      <p style="text-align:right">Balance: ${money(balance)}</p>
      <p style="text-align:center">Thank you!</p>`;
  }

  return (
    <div>
      <PageHeader
        title="Point of Sale"
        description="Scan or search, then take payment. Stock updates instantly."
        actions={
          <div className="flex items-center gap-2">
            <Select value={priceMode} onValueChange={(v) => setPriceMode(v as "retail" | "wholesale")}>
              <SelectTrigger className="w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="retail">Retail price</SelectItem>
                <SelectItem value="wholesale">Wholesale price</SelectItem>
              </SelectContent>
            </Select>
            <ScanButton onDetected={handleCode} />
          </div>
        }
      />

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-4">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={searchRef}
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && term.trim()) {
                  e.preventDefault();
                  void handleCode(term.trim());
                }
              }}
              placeholder="Scan barcode or search name / SKU…"
              className="h-12 pl-9 text-base"
            />
          </div>

          <SectionCard title={`Cart · ${lines.length} line${lines.length === 1 ? "" : "s"}`}>
            {lines.length === 0 ? (
              <EmptyState title="Cart is empty" hint="Scan a barcode or pick a product below." />
            ) : (
              <div className="space-y-3">
                {lines.map((l) => (
                  <div
                    key={l.variantId}
                    className="flex flex-wrap items-center gap-2 rounded-md border p-3"
                  >
                    <div className="min-w-40 flex-1">
                      <p className="text-sm font-medium">{l.productName}</p>
                      <p className="text-xs text-muted-foreground">
                        {l.label ? `${l.label} · ` : ""}
                        {l.sku} · {l.stock} in stock
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() =>
                          setLine(l.variantId, { quantity: Math.max(1, l.quantity - 1) })
                        }
                        aria-label="Decrease quantity"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <Input
                        className="num h-9 w-16 text-center"
                        value={l.quantity}
                        onChange={(e) =>
                          setLine(l.variantId, { quantity: Math.max(1, Number(e.target.value) || 1) })
                        }
                      />
                      <Button
                        size="icon"
                        variant="outline"
                        onClick={() => setLine(l.variantId, { quantity: l.quantity + 1 })}
                        aria-label="Increase quantity"
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                    <Input
                      className="num h-9 w-24"
                      value={l.unitPrice}
                      onChange={(e) =>
                        setLine(l.variantId, { unitPrice: Math.max(0, Number(e.target.value) || 0) })
                      }
                      aria-label="Unit price"
                    />
                    <Input
                      className="num h-9 w-24"
                      value={l.discount}
                      onChange={(e) =>
                        setLine(l.variantId, { discount: Math.max(0, Number(e.target.value) || 0) })
                      }
                      aria-label="Line discount"
                      placeholder="Disc."
                    />
                    <span className="num w-24 text-right text-sm font-semibold">
                      {money(l.unitPrice * l.quantity - l.discount)}
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => removeLine(l.variantId)}
                      aria-label="Remove line"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    {l.quantity > l.stock ? (
                      <Badge variant="destructive" className="w-full sm:w-auto">
                        Only {l.stock} in stock
                      </Badge>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Products">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {(resultsQ.data ?? []).map((v) => (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => addVariant(v, priceMode)}
                  className="rounded-md border p-3 text-left transition-colors hover:border-accent hover:bg-accent/5"
                >
                  <p className="truncate text-sm font-medium">{v.products?.name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {variantLabel(v) || v.sku}
                  </p>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="num text-sm font-semibold">
                      {money(priceMode === "wholesale" ? wholesaleOf(v) || priceOf(v) : priceOf(v))}
                    </span>
                    <span
                      className={`num text-xs ${v.stock <= 0 ? "text-destructive" : "text-muted-foreground"}`}
                    >
                      {v.stock} left
                    </span>
                  </div>
                </button>
              ))}
              {(resultsQ.data ?? []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No matching products.</p>
              ) : null}
            </div>
          </SectionCard>
        </div>

        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <SectionCard title="Customer">
            <div className="space-y-3">
              <Select value={customerId} onValueChange={setCustomerId}>
                <SelectTrigger>
                  <SelectValue placeholder="Walk-in customer" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="walkin">Walk-in customer</SelectItem>
                  {(customersQ.data ?? []).map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.shop_name ? `${c.shop_name} — ${c.name}` : c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {customerId === "walkin" ? (
                <Input
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  placeholder="Name on receipt (optional)"
                />
              ) : null}
            </div>
          </SectionCard>

          <SectionCard title="Payment">
            <div className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="num">{money(subtotal)}</span>
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="orderDiscount">Order discount</Label>
                <Input
                  id="orderDiscount"
                  className="num"
                  value={orderDiscount}
                  onChange={(e) => setOrderDiscount(e.target.value)}
                  placeholder="0"
                />
              </div>
              <div className="flex items-center justify-between border-t pt-3 text-base font-semibold">
                <span>Total</span>
                <span className="num">{money(total)}</span>
              </div>
              {canSeeCost ? (
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>Estimated profit</span>
                  <span className="num text-success">{money(profit)}</span>
                </div>
              ) : null}

              <div className="grid gap-1.5">
                <Label htmlFor="method">Method</Label>
                <Select value={method} onValueChange={setMethod}>
                  <SelectTrigger id="method">
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
                <Label htmlFor="tendered">Amount received</Label>
                <div className="flex gap-2">
                  <Input
                    id="tendered"
                    className="num"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    placeholder="0"
                  />
                  <Button type="button" variant="outline" onClick={() => setTendered(String(total))}>
                    Full
                  </Button>
                </div>
              </div>

              {method !== "Cash" ? (
                <Input
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="Reference / txn id"
                />
              ) : null}

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Balance (credit)</span>
                <span className={`num font-semibold ${balance > 0 ? "text-destructive" : ""}`}>
                  {money(balance)}
                </span>
              </div>
              {change > 0 ? (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Change due</span>
                  <span className="num font-semibold">{money(change)}</span>
                </div>
              ) : null}

              {balance > 0 ? (
                <div className="grid gap-1.5">
                  <Label htmlFor="due">Payment due date</Label>
                  <Input
                    id="due"
                    type="date"
                    value={dueDate}
                    onChange={(e) => setDueDate(e.target.value)}
                  />
                </div>
              ) : null}

              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Notes (optional)"
                rows={2}
              />

              <Button
                className="h-12 w-full text-base"
                disabled={lines.length === 0 || checkout.isPending}
                onClick={() => checkout.mutate()}
              >
                {checkout.isPending ? "Processing…" : `Complete sale · ${money(total)}`}
              </Button>
              <Button
                variant="outline"
                className="w-full"
                disabled={!lastSale.current}
                onClick={() =>
                  lastSale.current && printReport("Receipt", lastSale.current.html)
                }
              >
                <Printer className="mr-2 h-4 w-4" aria-hidden />
                Print last receipt
              </Button>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
