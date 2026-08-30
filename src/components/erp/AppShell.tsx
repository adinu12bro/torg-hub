import { useEffect, useState, type ReactNode } from "react";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Boxes,
  ClipboardList,
  CreditCard,
  FileBarChart,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Package,
  Receipt,
  ScanBarcode,
  Settings as SettingsIcon,
  ShieldCheck,
  ShoppingCart,
  Sun,
  Truck,
  Users,
  Wallet,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-session";
import { ROLE_LABEL, hasMinRole, type AppRole } from "@/lib/erp";
import { cn } from "@/lib/utils";

type NavItem = {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  min?: AppRole;
};

const NAV: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/pos", label: "POS / New Sale", icon: ShoppingCart },
  { to: "/scan", label: "Scanner", icon: ScanBarcode },
  { to: "/products", label: "Products", icon: Package },
  { to: "/inventory", label: "Inventory", icon: Boxes },
  { to: "/purchases", label: "Purchases", icon: ClipboardList, min: "manager" },
  { to: "/suppliers", label: "Suppliers", icon: Truck, min: "manager" },
  { to: "/customers", label: "Customers", icon: Users },
  { to: "/sales", label: "Sales History", icon: Receipt },
  { to: "/payments", label: "Payments & Credit", icon: CreditCard },
  { to: "/expenses", label: "Expenses", icon: Wallet, min: "manager" },
  { to: "/reports", label: "Reports", icon: FileBarChart, min: "manager" },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/users", label: "Users & Roles", icon: ShieldCheck, min: "admin" },
  { to: "/audit", label: "Audit Logs", icon: ShieldCheck, min: "manager" },
  { to: "/settings", label: "Settings", icon: SettingsIcon },
];

const MOBILE_NAV: NavItem[] = [
  { to: "/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/scan", label: "Scan", icon: ScanBarcode },
  { to: "/pos", label: "Sell", icon: ShoppingCart },
  { to: "/inventory", label: "Stock", icon: Boxes },
  { to: "/customers", label: "Clients", icon: Users },
];

function useTheme() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const toggle = () => {
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("torg-theme", next ? "dark" : "light");
    setDark(next);
  };
  return { dark, toggle };
}

function NavList({ role, onNavigate }: { role: AppRole | null; onNavigate?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-0.5 p-2">
      {NAV.filter((i) => !i.min || hasMinRole(role, i.min)).map((item) => {
        const active = pathname === item.to;
        return (
          <Link
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              active
                ? "bg-sidebar-accent text-sidebar-accent-foreground"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
            )}
          >
            <item.icon className={cn("h-4 w-4", active && "text-sidebar-primary")} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const { profile, role, loading } = useCurrentUser();
  const { dark, toggle } = useTheme();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (!loading && !role) {
    return (
      <div className="flex min-h-screen items-center justify-center px-6 text-center">
        <div className="max-w-sm">
          <h1 className="text-lg font-semibold">Access pending</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Your account has no role assigned yet. Ask a Super Admin to grant you access.
          </p>
          <Button className="mt-4" variant="outline" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-sidebar-border bg-sidebar lg:flex">
        <div className="px-4 py-5">
          <p className="font-display text-lg font-bold text-sidebar-foreground">TORG</p>
          <p className="text-[10px] uppercase tracking-[0.25em] text-sidebar-primary">Operations</p>
        </div>
        <div className="flex-1 overflow-y-auto">
          <NavList role={role} />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <p className="truncate text-xs font-medium text-sidebar-foreground">
            {profile?.full_name || profile?.email || "Staff"}
          </p>
          <p className="text-[11px] text-sidebar-foreground/60">
            {role ? ROLE_LABEL[role] : "No role"}
          </p>
        </div>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-2 border-b bg-background/95 px-3 backdrop-blur">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 bg-sidebar p-0">
              <SheetTitle className="px-4 pt-4 font-display text-sidebar-foreground">
                TORG Operations
              </SheetTitle>
              <div className="overflow-y-auto pb-8">
                <NavList role={role} onNavigate={() => setOpen(false)} />
              </div>
            </SheetContent>
          </Sheet>

          <span className="font-display text-sm font-semibold capitalize">
            {pathname.split("/").filter(Boolean).slice(-1)[0]?.replace("-", " ") || "Dashboard"}
          </span>

          <div className="ml-auto flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={toggle} aria-label="Toggle theme">
              {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="icon" asChild aria-label="Notifications">
              <Link to="/notifications">
                <Bell className="h-4 w-4" />
              </Link>
            </Button>
            <Button variant="ghost" size="icon" onClick={signOut} aria-label="Sign out">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </header>

        <main className="min-h-[calc(100vh-3.5rem)] pb-24 lg:pb-6">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t bg-card lg:hidden">
        {MOBILE_NAV.map((item) => {
          const active = pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center gap-1 py-2 text-[10px] font-medium",
                active ? "text-accent" : "text-muted-foreground",
              )}
            >
              <item.icon className="h-5 w-5" aria-hidden />
              {item.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
