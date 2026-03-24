import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

interface FomentoAuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  fomentoRole: string | null;
  fomentoOrgId: string | null;
  profileName: string | null;
  isSuperadmin: boolean;
  isAuditor: boolean;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
}

const FomentoAuthContext = createContext<FomentoAuthContextType>({
  user: null,
  session: null,
  loading: true,
  fomentoRole: null,
  fomentoOrgId: null,
  profileName: null,
  isSuperadmin: false,
  isAuditor: false,
  signOut: async () => {},
  refreshRole: async () => {},
});

export const useFomentoAuth = () => useContext(FomentoAuthContext);

export const FomentoAuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [fomentoRole, setFomentoRole] = useState<string | null>(null);
  const [fomentoOrgId, setFomentoOrgId] = useState<string | null>(null);
  const [profileName, setProfileName] = useState<string | null>(null);

  const isSuperadmin = fomentoRole === "superadmin";
  const isAuditor = fomentoRole === "auditor";

  const fetchFomentoRole = useCallback(async (userId: string) => {
    const { data: profile } = await supabase
      .from("profiles")
      .select("fomento_role, full_name, fomento_org_id")
      .eq("user_id", userId)
      .single();

    setFomentoRole((profile as any)?.fomento_role ?? null);
    setProfileName((profile as any)?.full_name ?? null);
    setFomentoOrgId((profile as any)?.fomento_org_id ?? null);
  }, []);

  const refreshRole = useCallback(async () => {
    if (user) await fetchFomentoRole(user.id);
  }, [user, fetchFomentoRole]);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user ?? null);

        if (newSession?.user) {
          setTimeout(() => fetchFomentoRole(newSession.user.id), 0);
        } else {
          setFomentoRole(null);
          setProfileName(null);
          setFomentoOrgId(null);
        }

        if (_event === "SIGNED_OUT") setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchFomentoRole(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [fetchFomentoRole]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setFomentoRole(null);
    setProfileName(null);
    setFomentoOrgId(null);
    window.location.replace("/");
  }, []);

  return (
    <FomentoAuthContext.Provider value={{ user, session, loading, fomentoRole, fomentoOrgId, profileName, isSuperadmin, isAuditor, signOut, refreshRole }}>
      {children}
    </FomentoAuthContext.Provider>
  );
};
