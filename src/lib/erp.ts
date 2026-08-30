import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];

export const ROLE_RANK: Record<AppRole, number> = {
  staff: 1,
  manager: 2,
  admin: 3,
  super_admin: 4,
};

export const ROLE_LABEL: Record<AppRole, string> = {
  staff: "Staff",
  manager: "Manager",
  admin: "Admin",
  super_admin: "Super Admin",
};

export function hasMinRole(role: AppRole | null, min: AppRole) {
  if (!role) return false;
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export const CURRENCY = "₹";

export function money(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  return `${CURRENCY}${n.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function compactMoney(value: number | string | null | undefined) {
  const n = Number(value ?? 0);
  if (Math.abs(n) >= 10000000) return `${CURRENCY}${(n / 10000000).toFixed(2)}Cr`;
  if (Math.abs(n) >= 100000) return `${CURRENCY}${(n / 100000).toFixed(2)}L`;
  if (Math.abs(n) >= 1000) return `${CURRENCY}${(n / 1000).toFixed(1)}K`;
  return money(n);
}

export function num(value: number | string | null | undefined) {
  return Number(value ?? 0);
}

/** Profit per unit = selling price - buy price */
export function profitPerUnit(sell: number, buy: number) {
  return num(sell) - num(buy);
}

/** Margin % = profit / selling price * 100 */
export function marginPct(sell: number, buy: number) {
  const s = num(sell);
  if (s <= 0) return 0;
  return ((s - num(buy)) / s) * 100;
}

export function pct(value: number) {
  return `${num(value).toFixed(1)}%`;
}

export function variantLabel(v: { color?: string | null; size?: string | null }) {
  return [v.color, v.size].filter(Boolean).join(" / ") || "Default";
}

export function dateOnly(d: Date) {
  return d.toISOString().slice(0, 10);
}

export function startOfToday() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export function daysAgo(n: number) {
  const d = startOfToday();
  d.setDate(d.getDate() - n);
  return d;
}

export function startOfMonth() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

export function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function toCsv(rows: Record<string, unknown>[]) {
  if (rows.length === 0) return "";
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  const blob = new Blob([toCsv(rows)], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function printReport(title: string, html: string) {
  const w = window.open("", "_blank", "width=900,height=650");
  if (!w) return;
  w.document.write(
    `<html><head><title>${title}</title><style>
      body{font-family:ui-sans-serif,system-ui;padding:24px;color:#111}
      h1{font-size:20px;margin:0 0 4px}
      table{width:100%;border-collapse:collapse;margin-top:16px;font-size:12px}
      th,td{border-bottom:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f4f4f5}
      .right{text-align:right}
    </style></head><body>${html}</body></html>`,
  );
  w.document.close();
  w.focus();
  w.print();
}

export const EXPENSE_CATEGORIES = [
  "Transport",
  "Packaging",
  "Rent",
  "Salary",
  "Marketing",
  "Electricity",
  "Maintenance",
  "Other",
];

export const PAYMENT_METHODS = ["Cash", "UPI", "Card", "Bank Transfer", "Other"];
