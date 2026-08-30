import { createFileRoute, Link } from "@tanstack/react-router";
import { BarChart3, Boxes, ScanBarcode, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useSession } from "@/hooks/use-session";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "TORG Operations — Internal ERP & POS" },
      {
        name: "description",
        content:
          "Sign in to the TORG Wholesale internal workspace for point of sale, inventory, purchases, customers and business reporting.",
      },
      { property: "og:title", content: "TORG Operations — Internal ERP & POS" },
      {
        property: "og:description",
        content: "Internal ERP, POS and inventory workspace for TORG Wholesale staff.",
      },
    ],
  }),
  component: Landing,
});

const HIGHLIGHTS = [
  { icon: ScanBarcode, title: "Scan to sell", text: "Barcode-first POS built for counter speed." },
  { icon: Boxes, title: "Live inventory", text: "Every movement ledgered by variant." },
  { icon: ShoppingCart, title: "Wholesale orders", text: "Credit, partial payments and returns." },
  { icon: BarChart3, title: "Real profit", text: "Cost, margin and net profit per day." },
];

function Landing() {
  const { session, loading } = useSession();

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-6 py-16">
        <p className="font-display text-xs uppercase tracking-[0.3em] text-accent">
          TORG Wholesale
        </p>
        <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight text-foreground sm:text-5xl">
          The internal operations workspace.
        </h1>
        <p className="mt-4 max-w-xl text-base text-muted-foreground">
          Point of sale, inventory ledger, purchases, customer credit and profit reporting — for
          TORG staff only. This is not the public store.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          {loading ? null : session ? (
            <Button size="lg" asChild>
              <Link to="/dashboard">Open workspace</Link>
            </Button>
          ) : (
            <Button size="lg" asChild>
              <Link to="/auth">Staff sign in</Link>
            </Button>
          )}
        </div>

        <div className="mt-16 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {HIGHLIGHTS.map((h) => (
            <div key={h.title} className="rounded-lg border bg-card p-4">
              <h.icon className="h-5 w-5 text-accent" aria-hidden />
              <h2 className="mt-3 text-sm font-semibold text-card-foreground">{h.title}</h2>
              <p className="mt-1 text-xs text-muted-foreground">{h.text}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
