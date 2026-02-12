import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserProfile {
  id: string;
  user_id: string;
  email: string | null;
  full_name: string | null;
  cpf: string | null;
  phone: string | null;
  whatsapp: string | null;
  photo_url: string | null;
  mini_bio: string | null;
  address_street: string | null;
  address_number: string | null;
  address_complement: string | null;
  address_neighborhood: string | null;
  address_city: string | null;
  address_state: string | null;
  address_country: string | null;
  address_zipcode: string | null;
  institution_affiliation: string | null;
  institution_id: string | null;
  institution_custom_name: string | null;
  institution_type: string | null;
  professional_position: string | null;
  lattes_url: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  research_area_cnpq: string | null;
  keywords: string[] | null;
  receive_news: boolean;
  receive_editais_notifications: boolean;
  profile_completed: boolean;
  profile_completed_at: string | null;
  updated_at: string;
}

export function useProfile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .single();
    if (data) setProfile(data as unknown as UserProfile);
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  const updateProfile = async (updates: Partial<UserProfile>) => {
    if (!user) return { error: "Not authenticated" };

    // Check if profile is now complete
    const merged = { ...profile, ...updates };
    const isComplete = !!(merged.full_name?.trim() && merged.phone?.trim() && merged.address_city?.trim() && merged.address_state?.trim());

    const finalUpdates: any = {
      ...updates,
      profile_completed: isComplete,
      profile_completed_at: isComplete && !profile?.profile_completed ? new Date().toISOString() : profile?.profile_completed_at,
    };

    const { error } = await supabase
      .from("profiles")
      .update(finalUpdates)
      .eq("user_id", user.id);

    if (!error) await fetchProfile();
    return { error: error?.message || null };
  };

  const completionPercentage = (): number => {
    if (!profile) return 0;
    const fields = [
      profile.full_name, profile.phone, profile.address_city,
      profile.address_state, profile.address_street, profile.address_zipcode,
      profile.mini_bio, profile.institution_affiliation,
    ];
    const filled = fields.filter((f) => f && f.trim()).length;
    return Math.round((filled / fields.length) * 100);
  };

  return { profile, loading, updateProfile, fetchProfile, completionPercentage };
}
