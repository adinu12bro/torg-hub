import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-session";
import { EmptyState, Loading, PageHeader, SectionCard, StatCard } from "@/components/erp/ui";
import {
  compactMoney,
  daysAgo,
  formatDateTime,
  money,
  num,
  pct,
  startOfMonth,
  startOfToday,
  variantLabel,
} from "@/lib/erp";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — TORG Operations" },
      { name: "description", content: "Sales, profit, inventory value and stock alerts for TORG Wholesale." },
      { property: "og:title", content: "Dashboard — TORG Operations" },
      { property: "og:description", content: "Live wholesale performance for the TORG team." },
    ],
  }),
  component: Dashboard,
});

const RANGES = [
  { key: "today", label: "Today", from: () => startOfToday() },
  { key: "7d", label: "7 days", from: () => daysAgo(6) },
  { key: "30d", label: "30 days", from: () => daysAgo(29) },
  { key: "mtd", label: "This month", from: () => startOfMonth() },
  { key: "90d", label: "90 days", from: () => daysAgo(89) },
] as const;

function Dashboard() {
  const { canSeeCost } = useCurrentUser();
  const [range, setRange] = useState<(typeof RANGES)[number]["key"]>("30d");
  const from = useMemo(() => RANGES.find((r) => r.key === range)!.from(), [range]);

  const salesQ = useQuery({
    queryKey: ["dash-sales", from.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_no, customer_id, customer_name, revenue, cost, profit, balance, payment_status, status, created_at")
        .gte("created_at", from.toISOString())
        .eq("status", "completed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const todayQ = useQuery({
    queryKey: ["dash-today"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("revenue, profit")
        .gte("created_at", startOfToday().toISOString())
        .eq("status", "completed");
      if (error) throw error;
      return data;
    },
  });

  const monthQ = useQuery({
    queryKey: ["dash-month"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("revenue, profit")
        .gte("created_at", startOfMonth().toISOString())
        .eq("status", "completed");
      if (error) throw error;
      return data;
    },
  });

  const itemsQ = useQuery({
    queryKey: ["dash-items", from.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sale_items")
        .select("product_id, product_name, quantity, line_revenue, line_profit, sale_id, sales!inner(created_at, status)")
        .gte("sales.created_at", from.toISOString())
        .eq("sales.status", "completed");
      if (error) throw error;
      return data;
    },
  });

  const stockQ = useQuery({
    queryKey: ["dash-stock"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_variants")
        .select("id, sku, color, size, stock, min_stock, buy_price, selling_price, is_active, products!inner(id, name, min_stock, buy_price, selling_price, status, suppliers(name))")
        .eq("is_active", true)
        .eq("products.status", "active");
      if (error) throw error;
      return data;
    },
  });

  const expensesQ = useQuery({
    queryKey: ["dash-expenses", from.toISOString()],
    enabled: canSeeCost,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses")
        .select("amount, category, expense_date")
        .gte("expense_date", from.toISOString().slice(0, 10));
      if (error) throw error;
      return data;
    },
  });

  const outstandingQ = useQuery({
    queryKey: ["dash-outstanding"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sales")
        .select("id, sale_no, customer_name, balance, customers(name, shop_name)")
        .gt("balance", 0)
        .eq("status", "completed")
        .order("balance", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data;
    },
  });

  const movementsQ = useQuery({
    queryKey: ["dash-movements"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("id, qty_change, new_qty, movement_type, reason, created_at, products(name), product_variants(color, size, sku)")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const sales = salesQ.data ?? [];
  const revenue = sales.reduce((s, r) => s + num(r.revenue), 0);
  const cost = sales.reduce((s, r) => s + num(r.cost), 0);
  const grossProfit = revenue - cost;
  const expenses = (expensesQ.data ?? []).reduce((s, e) => s + num(e.amount), 0);
  const netProfit = grossProfit - expenses;
  const margin = revenue > 0 ? (grossProfit / revenue) * 100 : 0;
  const todayRevenue = (todayQ.data ?? []).reduce((s, r) => s + num(r.revenue), 0);
  const monthRevenue = (monthQ.data ?? []).reduce((s, r) => s + num(r.revenue), 0);

  const variants = stockQ.data ?? [];
  const inventoryValue = variants.reduce(
    (s, v) => s + v.stock * num(v.buy_price ?? v.products?.buy_price),
    0,
  );
  const inventoryPotential = variants.reduce(
    (s, v) =>
      s +
      v.stock * (num(v.selling_price ?? v.products?.selling_price) - num(v.buy_price ?? v.products?.buy_price)),
    0,
  );
  const outOfStock = variants.filter((v) => v.stock <= 0);
  const lowStock = variants.filter((v) => {
    const min = v.min_stock ?? v.products?.min_stock ?? 0;
    return v.stock > 0 && v.stock <= min;
  });

  const items = itemsQ.data ?? [];
  const byProduct = new Map<string, { name: string; qty: number; revenue: number; profit: number }>();
  for (const it of items) {
    const cur = byProduct.get(it.product_id) ?? {
      name: it.product_name,
      qty: 0,
      revenue: 0,
      profit: 0,
    };
    cur.qty += it.quantity;
    cur.revenue += num(it.line_revenue);
    cur.profit += num(it.line_profit);
    byProduct.set(it.product_id, cur);
  }
  const topProducts = [...byProduct.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 8);
  const soldProductIds = new Set(items.map((i) => i.product_id));
  const deadStock = variants
    .filter((v) => v.stock > 0 && !soldProductIds.has(v.products.id))
    .slice(0, 8);

  const byCustomer = new Map<string, { name: string; revenue: number; profit: number; orders: number }>();
  for (const s of sales) {
    const key = s.customer_id ?? "walkin";
    const cur = byCustomer.get(key) ?? {
      name: s.customer_name || "Walk-in",
      revenue: 0,
      profit: 0,
      orders: 0,
    };
    cur.revenue += num(s.revenue);
    cur.profit += num(s.profit);
    cur.orders += 1;
    byCustomer.set(key, cur);
  }
  const topCustomers = [...byCustomer.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);

  const series = useMemo(() => {
    const map = new Map<string, { day: string; revenue: number; profit: number }>();
    for (const s of sales) {
      const day = new Date(s.created_at).toISOString().slice(0, 10);
      const cur = map.get(day) ?? { day, revenue: 0, profit: 0 };
      cur.revenue += num(s.revenue);
      cur.profit += num(s.profit);
      map.set(day, cur);
    }
    return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [sales]);

  const outstandingTotal = (outstandingQ.data ?? []).reduce((s, r) => s + num(r.balance), 0);

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="Live trading, stock and profit position."
        actions={
          <div className="flex flex-wrap gap-1">
            {RANGES.map((r) => (
              <Button
                key={r.key}
                size="sm"
                variant={range === r.key ? "default" : "outline"}
                onClick={() => setRange(r.key)}
              >
                {r.label}
              </Button>
            ))}
          </div>
        }
      />

      <div className="space-y-4 p-4 sm:p-6">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Today's sales" value={money(todayRevenue)} />
          <StatCard label="This month" value={money(monthRevenue)} />
          <StatCard label="Revenue (range)" value={money(revenue)} />
          {canSeeCost ? (
            <StatCard
              label="Gross profit"
              value={money(grossProfit)}
              tone={grossProfit >= 0 ? "positive" : "negative"}
              hint={`Margin ${pct(margin)}`}
            />
          ) : (
            <StatCard label="Orders" value={sales.length} />
          )}
        </div>

        {canSeeCost ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Expenses (range)" value={money(expenses)} />
            <StatCard
              label="Net profit"
              value={money(netProfit)}
              tone={netProfit >= 0 ? "positive" : "negative"}
            />
            <StatCard label="Inventory value" value={money(inventoryValue)} />
            <StatCard
              label="Potential inventory profit"
              value={money(inventoryPotential)}
              tone="accent"
            />
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard title="Revenue & profit trend" className="lg:col-span-2">
            {salesQ.isLoading ? (
              <Loading />
            ) : series.length === 0 ? (
              <EmptyState title="No sales in this range" hint="Complete a sale in POS to see trends." />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={series}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                    <XAxis dataKey="day" fontSize={11} tickFormatter={(d) => d.slice(5)} />
                    <YAxis fontSize={11} tickFormatter={(v) => compactMoney(v)} width={64} />
                    <Tooltip formatter={(v: number) => money(v)} />
                    <Area
                      type="monotone"
                      dataKey="revenue"
                      stroke="var(--chart-1)"
                      fill="var(--chart-1)"
                      fillOpacity={0.15}
                      name="Revenue"
                    />
                    {canSeeCost ? (
                      <Area
                        type="monotone"
                        dataKey="profit"
                        stroke="var(--chart-2)"
                        fill="var(--chart-2)"
                        fillOpacity={0.2}
                        name="Profit"
                      />
                    ) : null}
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Top products">
            {topProducts.length === 0 ? (
              <EmptyState title="No product sales yet" />
            ) : (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={topProducts} layout="vertical" margin={{ left: 8 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="name" width={100} fontSize={10} />
                    <Tooltip formatter={(v: number) => money(v)} />
                    <Bar dataKey="revenue" fill="var(--chart-2)" radius={4} name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard
            title={`Low stock (${lowStock.length})`}
            actions={
              <Button size="sm" variant="ghost" asChild>
                <Link to="/inventory">Manage</Link>
              </Button>
            }
          >
            {stockQ.isLoading ? (
              <Loading />
            ) : lowStock.length === 0 ? (
              <EmptyState title="Nothing below minimum" />
            ) : (
              <ul className="space-y-2 text-sm">
                {lowStock.slice(0, 8).map((v) => {
                  const min = v.min_stock ?? v.products?.min_stock ?? 0;
                  return (
                    <li key={v.id} className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{v.products?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {variantLabel(v)} · {v.products?.suppliers?.name ?? "No supplier"} ·
                          reorder ~{Math.max(min * 2 - v.stock, min)}
                        </p>
                      </div>
                      <Badge variant="outline" className="num shrink-0 border-warning text-warning">
                        {v.stock}/{min}
                      </Badge>
                    </li>
                  );
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard title={`Out of stock (${outOfStock.length})`}>
            {outOfStock.length === 0 ? (
              <EmptyState title="Everything in stock" />
            ) : (
              <ul className="space-y-2 text-sm">
                {outOfStock.slice(0, 8).map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2">
                    <span>
                      {v.products?.name}{" "}
                      <span className="text-xs text-muted-foreground">{variantLabel(v)}</span>
                    </span>
                    <Badge variant="destructive">0</Badge>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Slow / dead stock">
            {deadStock.length === 0 ? (
              <EmptyState title="All stock is moving" />
            ) : (
              <ul className="space-y-2 text-sm">
                {deadStock.map((v) => (
                  <li key={v.id} className="flex items-center justify-between gap-2">
                    <span>
                      {v.products?.name}{" "}
                      <span className="text-xs text-muted-foreground">{variantLabel(v)}</span>
                    </span>
                    <span className="num text-xs text-muted-foreground">{v.stock} on hand</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard title="Top customers">
            {topCustomers.length === 0 ? (
              <EmptyState title="No customer sales yet" />
            ) : (
              <ul className="space-y-2 text-sm">
                {topCustomers.map((c) => (
                  <li key={c.name} className="flex items-center justify-between gap-2">
                    <span>
                      {c.name}
                      <span className="ml-2 text-xs text-muted-foreground">{c.orders} orders</span>
                    </span>
                    <span className="num font-medium">{money(c.revenue)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title={`Outstanding balances · ${money(outstandingTotal)}`}
            actions={
              <Button size="sm" variant="ghost" asChild>
                <Link to="/payments">Collect</Link>
              </Button>
            }
          >
            {(outstandingQ.data ?? []).length === 0 ? (
              <EmptyState title="No credit outstanding" />
            ) : (
              <ul className="space-y-2 text-sm">
                {(outstandingQ.data ?? []).slice(0, 8).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <span>
                      #{s.sale_no} · {s.customers?.shop_name || s.customers?.name || s.customer_name || "Walk-in"}
                    </span>
                    <span className="num font-medium text-destructive">{money(s.balance)}</span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>

          <SectionCard title="Recent inventory activity">
            {(movementsQ.data ?? []).length === 0 ? (
              <EmptyState title="No stock movements yet" />
            ) : (
              <ul className="space-y-2 text-sm">
                {(movementsQ.data ?? []).map((m) => (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <span className="truncate">
                      {m.products?.name}
                      <span className="ml-1 text-xs text-muted-foreground">{m.movement_type}</span>
                    </span>
                    <span
                      className={`num text-xs font-medium ${m.qty_change >= 0 ? "text-success" : "text-destructive"}`}
                    >
                      {m.qty_change > 0 ? "+" : ""}
                      {m.qty_change}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </SectionCard>
        </div>

        <SectionCard
          title="Recent sales"
          actions={
            <Button size="sm" variant="ghost" asChild>
              <Link to="/sales">View all</Link>
            </Button>
          }
        >
          {salesQ.isLoading ? (
            <Loading />
          ) : sales.length === 0 ? (
            <EmptyState title="No sales yet" hint="Head to POS to record your first sale." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-muted-foreground">
                    <th className="py-2">Sale</th>
                    <th>Customer</th>
                    <th className="text-right">Revenue</th>
                    {canSeeCost ? <th className="text-right">Profit</th> : null}
                    <th className="text-right">Status</th>
                    <th className="text-right">When</th>
                  </tr>
                </thead>
                <tbody>
                  {sales.slice(0, 10).map((s) => (
                    <tr key={s.id} className="border-t">
                      <td className="py-2 num">#{s.sale_no}</td>
                      <td>{s.customer_name || "Walk-in"}</td>
                      <td className="num text-right">{money(s.revenue)}</td>
                      {canSeeCost ? (
                        <td className="num text-right text-success">{money(s.profit)}</td>
                      ) : null}
                      <td className="text-right">
                        <Badge variant={s.payment_status === "paid" ? "secondary" : "outline"}>
                          {s.payment_status}
                        </Badge>
                      </td>
                      <td className="text-right text-xs text-muted-foreground">
                        {formatDateTime(s.created_at)}
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
  );
}
