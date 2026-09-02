import { useCallback, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { EmptyState, PageHeader, SectionCard, StatCard } from "@/components/erp/ui";
import { ScanButton, useHardwareScanner } from "@/components/erp/BarcodeScanner";
import { costOf, findByCode, priceOf, wholesaleOf } from "@/lib/catalog";
import { marginPct, money, num, pct, variantLabel } from "@/lib/erp";

export const Route = createFileRoute("/_authenticated/scan")({
  head: () => ({
    meta: [
      { title: "Barcode Scanner — TORG Wholesale" },
      {
        name: "description",
        content: "Scan any barcode to check price, stock and margin, or adjust quantities instantly.",
      },
      { property: "og:title", content: "Barcode Scanner — TORG Wholesale" },
      { property: "og:description", content: "Instant product lookup and stock adjustment." },
    ],
  }),
  component: Scan,
});

type Found = Awaited<ReturnType<typeof findByCode>>;

function Scan() {
  const qc = useQueryClient();
  const { canSeeCost, can } = useCurrentUser();
  const canAdjust = can("manager");
  const [code, setCode] = useState("");
  const [found, setFound] = useState<Found>(null);
  const [history, setHistory] = useState<{ code: string; name: string }[]>([]);
  const [qty, setQty] = useState("1");
  const [type, setType] = useState("adjustment");
  const [reason, setReason] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const lookup = useCallback(async (raw: string) => {
    const value = raw.trim();
    if (!value) return;
    try {
      const v = await findByCode(value);
      if (!v) {
        setFound(null);
        toast.error(`No product matches ${value}`);
        return;
      }
      setFound(v);
      setHistory((h) => [{ code: value, name: v.products?.name ?? "" }, ...h].slice(0, 8));
      setCode("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Lookup failed");
    }
  }, []);

  useHardwareScanner(lookup);

  const adjust = useMutation({
    mutationFn: async () => {
      if (!found) throw new Error("Scan a product first");
      const change = Math.trunc(num(qty));
      if (change === 0) throw new Error("Quantity must not be zero");
      if (!reason.trim()) throw new Error("A reason is required");
      const signed = type === "receive" || type === "return" ? Math.abs(change) : -Math.abs(change);
      const { data, error } = await supabase.rpc("adjust_stock", {
        _variant_id: found.id,
        _qty_change: type === "adjustment" ? change : signed,
        _type: type as "receive" | "adjustment" | "damage" | "loss" | "return",
        _reason: reason.trim(),
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: (newQty) => {
      toast.success(`Stock updated · now ${newQty}`);
      setFound((f) => (f ? { ...f, stock: newQty } : f));
      setQty("1");
      setReason("");
      qc.invalidateQueries();
      inputRef.current?.focus();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Adjustment failed"),
  });

  const sell = found ? priceOf(found) : 0;
  const buy = found ? costOf(found) : 0;
  const wholesale = found ? wholesaleOf(found) || sell : 0;
  const minStock = found ? (found.min_stock ?? found.products?.min_stock ?? 0) : 0;

  return (
    <div>
      <PageHeader
        title="Barcode Scanner"
        description="Camera, USB or Bluetooth scanners all work. Enter also submits."
        actions={<ScanButton onDetected={lookup} />}
      />

      <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <div className="relative">
            <ScanLine
              className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              ref={inputRef}
              autoFocus
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void lookup(code);
                }
              }}
              placeholder="Scan or type a barcode / SKU…"
              className="h-14 pl-10 text-base"
            />
          </div>

          {!found ? (
            <EmptyState
              title="Nothing scanned yet"
              hint="Point the scanner at a barcode, or type a SKU and press Enter."
            />
          ) : (
            <>
              <SectionCard
                title={found.products?.name ?? "Product"}
                actions={
                  <Badge variant={found.stock > minStock ? "secondary" : "destructive"}>
                    {found.stock} in stock
                  </Badge>
                }
              >
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <StatCard label="Selling price" value={money(sell)} />
                  <StatCard label="Wholesale" value={money(wholesale)} />
                  {canSeeCost ? <StatCard label="Buy price" value={money(buy)} /> : null}
                  {canSeeCost ? (
                    <StatCard
                      label="Margin"
                      value={pct(marginPct(sell, buy))}
                      tone="positive"
                      hint={`${money(sell - buy)} per unit`}
                    />
                  ) : null}
                </div>
                <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Variant</dt>
                    <dd>{variantLabel(found) || "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">SKU</dt>
                    <dd className="num">{found.sku}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Barcode</dt>
                    <dd className="num">{found.barcode ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Supplier</dt>
                    <dd>{found.products?.suppliers?.name ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Category</dt>
                    <dd>{found.products?.categories?.name ?? "—"}</dd>
                  </div>
                  <div className="flex justify-between gap-2">
                    <dt className="text-muted-foreground">Low-stock level</dt>
                    <dd className="num">{minStock}</dd>
                  </div>
                </dl>
                <div className="mt-4 flex gap-2">
                  <Button asChild>
                    <Link to="/pos">Sell in POS</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link to="/inventory">Open inventory</Link>
                  </Button>
                </div>
              </SectionCard>

              {canAdjust ? (
                <SectionCard title="Quick stock adjustment">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="grid gap-1.5">
                      <Label htmlFor="type">Movement</Label>
                      <Select value={type} onValueChange={setType}>
                        <SelectTrigger id="type">
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
                      <Label htmlFor="qty">Quantity</Label>
                      <Input
                        id="qty"
                        className="num"
                        value={qty}
                        onChange={(e) => setQty(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-1.5 sm:col-span-2">
                      <Label htmlFor="reason">Reason (required)</Label>
                      <Input
                        id="reason"
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="e.g. damaged in transit"
                      />
                    </div>
                  </div>
                  <Button
                    className="mt-3"
                    disabled={adjust.isPending}
                    onClick={() => adjust.mutate()}
                  >
                    {adjust.isPending ? "Applying…" : "Apply adjustment"}
                  </Button>
                </SectionCard>
              ) : null}
            </>
          )}
        </div>

        <SectionCard title="Recent scans">
          {history.length === 0 ? (
            <p className="text-sm text-muted-foreground">Scans from this session appear here.</p>
          ) : (
            <ul className="space-y-2 text-sm">
              {history.map((h, i) => (
                <li key={`${h.code}-${i}`}>
                  <button
                    type="button"
                    className="w-full text-left hover:text-accent"
                    onClick={() => void lookup(h.code)}
                  >
                    <span className="font-medium">{h.name}</span>
                    <span className="num ml-2 text-xs text-muted-foreground">{h.code}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      </div>
    </div>
  );
}
