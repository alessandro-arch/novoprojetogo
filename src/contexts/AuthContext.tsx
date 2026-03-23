import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";

type AppRole = "icca_admin" | "org_admin" | "edital_manager" | "proponente" | "reviewer";

interface UserMembership {
  organization_id: string;
  role: AppRole;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  globalRole: AppRole | null;
  membership: UserMembership | null;
  fomentoRole: string | null;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  globalRole: null,
  membership: null,
  fomentoRole: null,
  signOut: async () => {},
  refreshRoles: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalRole, setGlobalRole] = useState<AppRole | null>(null);
  const [membership, setMembership] = useState<UserMembership | null>(null);
  const [fomentoRole, setFomentoRole] = useState<string | null>(null);

  let queryClient: ReturnType<typeof useQueryClient> | null = null;
  try {
    queryClient = useQueryClient();
  } catch {
    // QueryClient may not be available in some contexts
  }

  const fetchRoles = useCallback(async (userId: string) => {
    // Check global roles (icca_admin)
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);

    if (roles && roles.length > 0) {
      setGlobalRole(roles[0].role as AppRole);
    } else {
      setGlobalRole(null);
    }

    // Check org membership
    let { data: members } = await supabase
      .from("organization_members")
      .select("organization_id, role")
      .eq("user_id", userId);

    // Fallback: ensure default membership if none exists
    if (!members || members.length === 0) {
      await supabase.rpc("ensure_default_membership");
      const { data: retryMembers } = await supabase
        .from("organization_members")
        .select("organization_id, role")
        .eq("user_id", userId);
      members = retryMembers;
    }

    if (members && members.length > 0) {
      setMembership({
        organization_id: members[0].organization_id,
        role: members[0].role as AppRole,
      });
    } else {
      setMembership(null);
    }

    // Fetch fomento_role from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("fomento_role")
      .eq("user_id", userId)
      .single();

    setFomentoRole((profile as any)?.fomento_role ?? null);
  }, []);

  const refreshRoles = useCallback(async () => {
    if (user) {
      await fetchRoles(user.id);
    }
  }, [user, fetchRoles]);

  useEffect(() => {
    // 1. Set up auth state change listener FIRST (Supabase best practice)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          // Use setTimeout to avoid potential deadlocks with Supabase client
          setTimeout(() => fetchRoles(newSession.user.id), 0);
        } else {
          setGlobalRole(null);
          setMembership(null);
        }

        // Only set loading false after we've processed the event
        if (event === "SIGNED_OUT") {
          setLoading(false);
        }
      }
    );

    // 2. Then rehydrate the existing session
    supabase.auth.getSession().then(({ data: { session: existingSession } }) => {
      setSession(existingSession);
      setUser(existingSession?.user ?? null);

      if (existingSession?.user) {
        fetchRoles(existingSession.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchRoles]);

  const signOut = useCallback(async () => {
    // 1. Sign out from Supabase
    await supabase.auth.signOut();

    // 2. Clear local state
    setUser(null);
    setSession(null);
    setGlobalRole(null);
    setMembership(null);

    // 3. Clear React Query cache
    if (queryClient) {
      queryClient.clear();
    }

    // 4. Replace history to prevent back-button access
    window.location.replace("/login");
  }, [queryClient]);

  return (
    <AuthContext.Provider value={{ user, session, loading, globalRole, membership, signOut, refreshRoles }}>
      {children}
    </AuthContext.Provider>
  );
};
