import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

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
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  globalRole: null,
  membership: null,
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

  const fetchRoles = async (userId: string) => {
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
  };

  const refreshRoles = async () => {
    if (user) {
      await fetchRoles(user.id);
    }
  };

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(() => fetchRoles(session.user.id), 0);
        } else {
          setGlobalRole(null);
          setMembership(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRoles(session.user.id);
      }
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setGlobalRole(null);
    setMembership(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, globalRole, membership, signOut, refreshRoles }}>
      {children}
    </AuthContext.Provider>
  );
};
