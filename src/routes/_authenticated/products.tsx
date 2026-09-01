import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Package, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { EmptyState, Loading, PageHeader, SectionCard } from "@/components/erp/ui";
import { ScanButton } from "@/components/erp/BarcodeScanner";
import {
  downloadCsv,
  marginPct,
  money,
  num,
  pct,
  profitPerUnit,
  variantLabel,
} from "@/lib/erp";

export const Route = createFileRoute("/_authenticated/products")({
  head: () => ({
    meta: [
      { title: "Products — TORG Wholesale" },
      {
        name: "description",
        content: "Catalogue of products, variants, pricing and stock for TORG Wholesale.",
      },
      { property: "og:title", content: "Products — TORG Wholesale" },
      { property: "og:description", content: "Manage catalogue, variants, barcodes and pricing." },
    ],
  }),
  component: Products,
});

type VariantDraft = {
  id?: string;
  color: string;
  size: string;
  sku: string;
  barcode: string;
  buy_price: string;
  selling_price: string;
  wholesale_price: string;
  stock: string;
  min_stock: string;
};

type ProductDraft = {
  id?: string;
  name: string;
  sku: string;
  brand: string;
  description: string;
  category_id: string;
  supplier_id: string;
  buy_price: string;
  selling_price: string;
  wholesale_price: string;
  min_stock: string;
  moq: string;
  status: "active" | "archived";
  variants: VariantDraft[];
};

const emptyVariant = (): VariantDraft => ({
  color: "",
  size: "",
  sku: "",
  barcode: "",
  buy_price: "",
  selling_price: "",
  wholesale_price: "",
  stock: "0",
  min_stock: "",
});

const emptyProduct = (): ProductDraft => ({
  name: "",
  sku: "",
  brand: "",
  description: "",
  category_id: "none",
  supplier_id: "none",
  buy_price: "",
  selling_price: "",
  wholesale_price: "",
  min_stock: "5",
  moq: "1",
  status: "active",
  variants: [emptyVariant()],
});

function autoSku(name: string, i: number) {
  const base = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 12);
  return `${base || "SKU"}-${String(i + 1).padStart(3, "0")}`;
}

function Products() {
  const qc = useQueryClient();
  const { canSeeCost, can } = useCurrentUser();
  const canEdit = can("manager");
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState<"active" | "archived" | "all">("active");
  const [draft, setDraft] = useState<ProductDraft | null>(null);

  const productsQ = useQuery({
    queryKey: ["products", status],
    queryFn: async () => {
      let q = supabase
        .from("products")
        .select(
          "id, name, sku, brand, description, status, buy_price, selling_price, wholesale_price, min_stock, moq, category_id, supplier_id, categories:category_id(name), suppliers(name), product_variants(id, color, size, sku, barcode, stock, min_stock, buy_price, selling_price, wholesale_price, is_active)",
        )
        .order("created_at", { ascending: false });
      if (status !== "all") q = q.eq("status", status);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const categoriesQ = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, parent_id, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const suppliersQ = useQuery({
    queryKey: ["suppliers-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const rows = useMemo(() => {
    const t = term.trim().toLowerCase();
    return (productsQ.data ?? []).filter((p) => {
      if (category !== "all" && p.category_id !== category) return false;
      if (!t) return true;
      return (
        p.name.toLowerCase().includes(t) ||
        (p.sku ?? "").toLowerCase().includes(t) ||
        (p.brand ?? "").toLowerCase().includes(t) ||
        p.product_variants.some(
          (v) =>
            (v.sku ?? "").toLowerCase().includes(t) ||
            (v.barcode ?? "").toLowerCase().includes(t),
        )
      );
    });
  }, [productsQ.data, term, category]);

  const save = useMutation({
    mutationFn: async (d: ProductDraft) => {
      if (!d.name.trim()) throw new Error("Product name is required");
      if (num(d.selling_price) <= 0) throw new Error("Selling price is required");
      const payload = {
        name: d.name.trim(),
        sku: d.sku.trim() || null,
        brand: d.brand.trim() || null,
        description: d.description.trim() || null,
        category_id: d.category_id === "none" ? null : d.category_id,
        supplier_id: d.supplier_id === "none" ? null : d.supplier_id,
        buy_price: num(d.buy_price),
        selling_price: num(d.selling_price),
        wholesale_price: num(d.wholesale_price) || num(d.selling_price),
        min_stock: Math.trunc(num(d.min_stock)),
        moq: Math.max(Math.trunc(num(d.moq)), 1),
        status: d.status,
      };

      let productId = d.id;
      if (productId) {
        const { error } = await supabase.from("products").update(payload).eq("id", productId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("products")
          .insert(payload)
          .select("id")
          .single();
        if (error) throw error;
        productId = data.id;
      }

      for (const [i, v] of d.variants.entries()) {
        const vPayload = {
          product_id: productId,
          color: v.color.trim() || null,
          size: v.size.trim() || null,
          sku: v.sku.trim() || autoSku(d.name, i),
          barcode: v.barcode.trim() || null,
          buy_price: v.buy_price === "" ? null : num(v.buy_price),
          selling_price: v.selling_price === "" ? null : num(v.selling_price),
          wholesale_price: v.wholesale_price === "" ? null : num(v.wholesale_price),
          min_stock: v.min_stock === "" ? null : Math.trunc(num(v.min_stock)),
        };
        if (v.id) {
          const { error } = await supabase.from("product_variants").update(vPayload).eq("id", v.id);
          if (error) throw error;
        } else {
          const { data: created, error } = await supabase
            .from("product_variants")
            .insert({ ...vPayload, stock: 0 })
            .select("id")
            .single();
          if (error) throw error;
          const opening = Math.trunc(num(v.stock));
          if (opening > 0) {
            const { error: adjErr } = await supabase.rpc("adjust_stock", {
              _variant_id: created.id,
              _qty_change: opening,
              _type: "initial",
              _reason: "Opening stock",
            });
            if (adjErr) throw adjErr;
          }
        }
      }
      return productId;
    },
    onSuccess: () => {
      toast.success("Product saved");
      qc.invalidateQueries();
      setDraft(null);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save product"),
  });

  const archive = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").update({ status: "archived" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Product archived");
      qc.invalidateQueries();
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not archive"),
  });

  function editProduct(p: NonNullable<typeof productsQ.data>[number]) {
    setDraft({
      id: p.id,
      name: p.name,
      sku: p.sku ?? "",
      brand: p.brand ?? "",
      description: p.description ?? "",
      category_id: p.category_id ?? "none",
      supplier_id: p.supplier_id ?? "none",
      buy_price: String(p.buy_price),
      selling_price: String(p.selling_price),
      wholesale_price: String(p.wholesale_price),
      min_stock: String(p.min_stock),
      moq: String(p.moq),
      status: p.status,
      variants: p.product_variants.map((v) => ({
        id: v.id,
        color: v.color ?? "",
        size: v.size ?? "",
        sku: v.sku,
        barcode: v.barcode ?? "",
        buy_price: v.buy_price === null ? "" : String(v.buy_price),
        selling_price: v.selling_price === null ? "" : String(v.selling_price),
        wholesale_price: v.wholesale_price === null ? "" : String(v.wholesale_price),
        stock: String(v.stock),
        min_stock: v.min_stock === null ? "" : String(v.min_stock),
      })),
    });
  }

  function exportCsv() {
    downloadCsv(
      "torg-products.csv",
      rows.flatMap((p) =>
        p.product_variants.map((v) => ({
          product: p.name,
          brand: p.brand ?? "",
          category: p.categories?.name ?? "",
          supplier: p.suppliers?.name ?? "",
          variant: variantLabel(v),
          sku: v.sku,
          barcode: v.barcode ?? "",
          stock: v.stock,
          buy_price: canSeeCost ? (v.buy_price ?? p.buy_price) : "",
          selling_price: v.selling_price ?? p.selling_price,
          wholesale_price: v.wholesale_price ?? p.wholesale_price,
        })),
      ),
    );
  }

  return (
    <div>
      <PageHeader
        title="Products"
        description="Catalogue, variants, pricing and barcodes."
        actions={
          <>
            <Button variant="outline" onClick={exportCsv}>
              <Download className="mr-2 h-4 w-4" aria-hidden />
              Export
            </Button>
            {canEdit ? (
              <Button onClick={() => setDraft(emptyProduct())}>
                <Plus className="mr-2 h-4 w-4" aria-hidden />
                New product
              </Button>
            ) : null}
          </>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-56 flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              value={term}
              onChange={(e) => setTerm(e.target.value)}
              placeholder="Search name, SKU, barcode…"
              className="pl-9"
            />
          </div>
          <ScanButton onDetected={(code) => setTerm(code)} />
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Category" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {(categoriesQ.data ?? []).map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="archived">Archived</SelectItem>
              <SelectItem value="all">All</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <SectionCard title={`${rows.length} product${rows.length === 1 ? "" : "s"}`}>
          {productsQ.isLoading ? (
            <Loading />
          ) : rows.length === 0 ? (
            <EmptyState title="No products yet" hint="Create your first product to start selling." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2">Product</th>
                    <th>Variants</th>
                    <th className="text-right">Stock</th>
                    {canSeeCost ? <th className="text-right">Buy</th> : null}
                    <th className="text-right">Sell</th>
                    <th className="text-right">Wholesale</th>
                    {canSeeCost ? <th className="text-right">Margin</th> : null}
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((p) => {
                    const stock = p.product_variants.reduce((s, v) => s + v.stock, 0);
                    const low = stock <= p.min_stock;
                    return (
                      <tr key={p.id} className="border-t align-top">
                        <td className="py-2">
                          <div className="flex items-start gap-2">
                            <Package className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden />
                            <div>
                              <p className="font-medium">{p.name}</p>
                              <p className="text-xs text-muted-foreground">
                                {[p.brand, p.categories?.name, p.suppliers?.name]
                                  .filter(Boolean)
                                  .join(" · ") || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="text-xs text-muted-foreground">
                          {p.product_variants.length === 0
                            ? "—"
                            : p.product_variants
                                .slice(0, 3)
                                .map((v) => variantLabel(v) || v.sku)
                                .join(", ")}
                          {p.product_variants.length > 3
                            ? ` +${p.product_variants.length - 3}`
                            : ""}
                        </td>
                        <td className="num text-right">
                          <span className={low ? "font-semibold text-destructive" : ""}>{stock}</span>
                        </td>
                        {canSeeCost ? (
                          <td className="num text-right">{money(p.buy_price)}</td>
                        ) : null}
                        <td className="num text-right">{money(p.selling_price)}</td>
                        <td className="num text-right">{money(p.wholesale_price)}</td>
                        {canSeeCost ? (
                          <td className="num text-right text-success">
                            {pct(marginPct(p.selling_price, p.buy_price))}
                            <span className="ml-1 text-xs text-muted-foreground">
                              {money(profitPerUnit(p.selling_price, p.buy_price))}
                            </span>
                          </td>
                        ) : null}
                        <td className="text-right">
                          {p.status === "archived" ? (
                            <Badge variant="outline">Archived</Badge>
                          ) : null}
                          {canEdit ? (
                            <>
                              <Button size="icon" variant="ghost" onClick={() => editProduct(p)}>
                                <Pencil className="h-4 w-4" aria-hidden />
                                <span className="sr-only">Edit</span>
                              </Button>
                              {p.status === "active" ? (
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => archive.mutate(p.id)}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" aria-hidden />
                                  <span className="sr-only">Archive</span>
                                </Button>
                              ) : null}
                            </>
                          ) : null}
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
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{draft?.id ? "Edit product" : "New product"}</DialogTitle>
            <DialogDescription>
              Base pricing applies to every variant unless the variant overrides it.
            </DialogDescription>
          </DialogHeader>

          {draft ? (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    value={draft.name}
                    onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="brand">Brand</Label>
                  <Input
                    id="brand"
                    value={draft.brand}
                    onChange={(e) => setDraft({ ...draft, brand: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="psku">Product code</Label>
                  <Input
                    id="psku"
                    value={draft.sku}
                    onChange={(e) => setDraft({ ...draft, sku: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label>Category</Label>
                  <Select
                    value={draft.category_id}
                    onValueChange={(v) => setDraft({ ...draft, category_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No category</SelectItem>
                      {(categoriesQ.data ?? []).map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Supplier</Label>
                  <Select
                    value={draft.supplier_id}
                    onValueChange={(v) => setDraft({ ...draft, supplier_id: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No supplier</SelectItem>
                      {(suppliersQ.data ?? []).map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="buy">Buy price</Label>
                  <Input
                    id="buy"
                    className="num"
                    value={draft.buy_price}
                    onChange={(e) => setDraft({ ...draft, buy_price: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="sell">Selling price</Label>
                  <Input
                    id="sell"
                    className="num"
                    value={draft.selling_price}
                    onChange={(e) => setDraft({ ...draft, selling_price: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="whole">Wholesale price</Label>
                  <Input
                    id="whole"
                    className="num"
                    value={draft.wholesale_price}
                    onChange={(e) => setDraft({ ...draft, wholesale_price: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="min">Low-stock alert</Label>
                  <Input
                    id="min"
                    className="num"
                    value={draft.min_stock}
                    onChange={(e) => setDraft({ ...draft, min_stock: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="moq">Minimum order qty</Label>
                  <Input
                    id="moq"
                    className="num"
                    value={draft.moq}
                    onChange={(e) => setDraft({ ...draft, moq: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5 sm:col-span-2">
                  <Label htmlFor="desc">Description</Label>
                  <Textarea
                    id="desc"
                    rows={2}
                    value={draft.description}
                    onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                  />
                </div>
              </div>

              {num(draft.selling_price) > 0 && num(draft.buy_price) > 0 ? (
                <p className="text-xs text-muted-foreground">
                  Profit per unit {money(profitPerUnit(num(draft.selling_price), num(draft.buy_price)))} ·
                  margin {pct(marginPct(num(draft.selling_price), num(draft.buy_price)))}
                </p>
              ) : null}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Variants</Label>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      setDraft({ ...draft, variants: [...draft.variants, emptyVariant()] })
                    }
                  >
                    <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
                    Add variant
                  </Button>
                </div>
                {draft.variants.map((v, i) => (
                  <div key={i} className="grid gap-2 rounded-md border p-3 sm:grid-cols-4">
                    <Input
                      placeholder="Colour"
                      value={v.color}
                      onChange={(e) => {
                        const variants = [...draft.variants];
                        variants[i] = { ...v, color: e.target.value };
                        setDraft({ ...draft, variants });
                      }}
                    />
                    <Input
                      placeholder="Size"
                      value={v.size}
                      onChange={(e) => {
                        const variants = [...draft.variants];
                        variants[i] = { ...v, size: e.target.value };
                        setDraft({ ...draft, variants });
                      }}
                    />
                    <Input
                      placeholder={autoSku(draft.name, i)}
                      value={v.sku}
                      onChange={(e) => {
                        const variants = [...draft.variants];
                        variants[i] = { ...v, sku: e.target.value };
                        setDraft({ ...draft, variants });
                      }}
                    />
                    <div className="flex gap-1">
                      <Input
                        placeholder="Barcode"
                        value={v.barcode}
                        onChange={(e) => {
                          const variants = [...draft.variants];
                          variants[i] = { ...v, barcode: e.target.value };
                          setDraft({ ...draft, variants });
                        }}
                      />
                      <ScanButton
                        onDetected={(code) => {
                          const variants = [...draft.variants];
                          variants[i] = { ...v, barcode: code };
                          setDraft({ ...draft, variants });
                        }}
                      />
                    </div>
                    <Input
                      className="num"
                      placeholder="Buy override"
                      value={v.buy_price}
                      onChange={(e) => {
                        const variants = [...draft.variants];
                        variants[i] = { ...v, buy_price: e.target.value };
                        setDraft({ ...draft, variants });
                      }}
                    />
                    <Input
                      className="num"
                      placeholder="Sell override"
                      value={v.selling_price}
                      onChange={(e) => {
                        const variants = [...draft.variants];
                        variants[i] = { ...v, selling_price: e.target.value };
                        setDraft({ ...draft, variants });
                      }}
                    />
                    <Input
                      className="num"
                      placeholder="Wholesale override"
                      value={v.wholesale_price}
                      onChange={(e) => {
                        const variants = [...draft.variants];
                        variants[i] = { ...v, wholesale_price: e.target.value };
                        setDraft({ ...draft, variants });
                      }}
                    />
                    {v.id ? (
                      <p className="self-center text-xs text-muted-foreground">
                        Stock {v.stock} · adjust in Inventory
                      </p>
                    ) : (
                      <Input
                        className="num"
                        placeholder="Opening stock"
                        value={v.stock}
                        onChange={(e) => {
                          const variants = [...draft.variants];
                          variants[i] = { ...v, stock: e.target.value };
                          setDraft({ ...draft, variants });
                        }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDraft(null)}>
              Cancel
            </Button>
            <Button
              disabled={save.isPending}
              onClick={() => draft && save.mutate(draft)}
            >
              {save.isPending ? "Saving…" : "Save product"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
