import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";
import { hasMinRole, type AppRole } from "@/lib/erp";

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useCurrentUser() {
  const { user, loading } = useSession();

  const { data, isLoading } = useQuery({
    queryKey: ["me", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const [profileRes, rolesRes] = await Promise.all([
        supabase.from("profiles").select("*").eq("id", user!.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user!.id),
      ]);
      const roles = (rolesRes.data ?? []).map((r) => r.role as AppRole);
      const rank = { staff: 1, manager: 2, admin: 3, super_admin: 4 } as const;
      const role =
        roles.sort((a, b) => rank[b] - rank[a])[0] ?? null;
      return { profile: profileRes.data, role };
    },
  });

  const role = data?.role ?? null;

  return {
    user,
    profile: data?.profile ?? null,
    role,
    loading: loading || isLoading,
    can: (min: AppRole) => hasMinRole(role, min),
    isManager: hasMinRole(role, "manager"),
    isAdmin: hasMinRole(role, "admin"),
    isSuperAdmin: hasMinRole(role, "super_admin"),
    /** Buy price / cost / profit visibility */
    canSeeCost: hasMinRole(role, "manager"),
  };
}
