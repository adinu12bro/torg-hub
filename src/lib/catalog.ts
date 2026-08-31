import { supabase } from "@/integrations/supabase/client";

export const VARIANT_SELECT =
  "id, product_id, sku, barcode, color, size, stock, min_stock, buy_price, selling_price, wholesale_price, is_active, products!inner(id, name, brand, sku, min_stock, buy_price, selling_price, wholesale_price, moq, status, images, categories:category_id(name), suppliers(id, name))";

export type VariantRow = Awaited<ReturnType<typeof findByCode>>;

/** Resolve a scanned/typed code to a single variant (barcode, alt barcode or SKU). */
export async function findByCode(code: string) {
  const term = code.trim();
  if (!term) return null;

  const direct = await supabase
    .from("product_variants")
    .select(VARIANT_SELECT)
    .or(`barcode.eq.${term},sku.eq.${term}`)
    .limit(1)
    .maybeSingle();
  if (direct.error) throw direct.error;
  if (direct.data) return direct.data;

  const alt = await supabase.from("barcodes").select("variant_id").eq("code", term).maybeSingle();
  if (alt.error) throw alt.error;
  if (!alt.data) return null;

  const byId = await supabase
    .from("product_variants")
    .select(VARIANT_SELECT)
    .eq("id", alt.data.variant_id)
    .maybeSingle();
  if (byId.error) throw byId.error;
  return byId.data;
}

/** Free-text search across product name, SKU and barcode. */
export async function searchVariants(term: string, limit = 25) {
  const t = term.trim();
  const query = supabase
    .from("product_variants")
    .select(VARIANT_SELECT)
    .eq("is_active", true)
    .eq("products.status", "active")
    .limit(limit);

  if (!t) {
    const { data, error } = await query.order("created_at", { ascending: false });
    if (error) throw error;
    return data ?? [];
  }

  const { data, error } = await query.or(
    `sku.ilike.%${t}%,barcode.ilike.%${t}%,color.ilike.%${t}%,size.ilike.%${t}%`,
  );
  if (error) throw error;

  const byName = await supabase
    .from("product_variants")
    .select(VARIANT_SELECT)
    .eq("is_active", true)
    .eq("products.status", "active")
    .ilike("products.name", `%${t}%`)
    .limit(limit);
  if (byName.error) throw byName.error;

  const merged = [...(data ?? []), ...(byName.data ?? [])];
  const seen = new Set<string>();
  return merged.filter((v) => (seen.has(v.id) ? false : (seen.add(v.id), true)));
}

export function priceOf(v: {
  selling_price: number | null;
  wholesale_price?: number | null;
  products: { selling_price: number; wholesale_price?: number } | null;
}) {
  return Number(v.selling_price ?? v.products?.selling_price ?? 0);
}

export function wholesaleOf(v: {
  wholesale_price: number | null;
  products: { wholesale_price: number } | null;
}) {
  return Number(v.wholesale_price ?? v.products?.wholesale_price ?? 0);
}

export function costOf(v: { buy_price: number | null; products: { buy_price: number } | null }) {
  return Number(v.buy_price ?? v.products?.buy_price ?? 0);
}
