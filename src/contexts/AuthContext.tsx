import { createContext, useEffect, useState, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/database";
import { signInReturnUrl } from "@/lib/oauthNavigation";

export interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ error: string | null; signedIn: boolean }>;
  signInWithGoogle: (redirectPath?: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  refreshProfile: () => Promise<void>;
}

// eslint-disable-next-line react-refresh/only-export-components
export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("sv_profiles").select("*").eq("id", userId).maybeSingle();
  if (error) {
    console.error("[auth] failed to load profile", error.message);
    return null;
  }
  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let currentUserId: string | null = null;
    let authRevision = 0;

    supabase.auth.getSession().then(({ data }) => {
      if (!active || authRevision > 0) return;
      currentUserId = data.session?.user.id ?? null;
      setSession(data.session);
      if (data.session) {
        const id = data.session.user.id;
        fetchProfile(id).then((p) => active && currentUserId === id && setProfile(p));
      }
      setLoading(false);
    });

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, newSession) => {
      authRevision += 1;
      const nextId = newSession?.user.id ?? null;
      if (currentUserId !== nextId) {
        queryClient.clear();
        setProfile(null);
      }
      currentUserId = nextId;
      setSession(newSession);
      setLoading(false);
      if (newSession) {
        const id = newSession.user.id;
        // Run outside Supabase's auth callback lock.
        setTimeout(() => {
          if (active && currentUserId === id) fetchProfile(id).then((p) => active && currentUserId === id && setProfile(p));
        }, 0);
      } else {
        setProfile(null);
      }
    });

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [queryClient]);

  const refreshProfile = async () => {
    if (!session) return;
    const p = await fetchProfile(session.user.id);
    setProfile(p);
  };

  const signIn: AuthContextValue["signIn"] = async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error: error?.message ?? null };
  };

  const signUp: AuthContextValue["signUp"] = async (email, password, fullName) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: { full_name: fullName.trim() },
        emailRedirectTo: signInReturnUrl(window.location.origin, "/onboarding"),
      },
    });
    return { error: error?.message ?? null, signedIn: Boolean(data.session) };
  };

  const signInWithGoogle: AuthContextValue["signInWithGoogle"] = async (redirectPath) => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: signInReturnUrl(window.location.origin, redirectPath) },
    });
    return { error: error?.message ?? null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const resetPassword: AuthContextValue["resetPassword"] = async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    return { error: error?.message ?? null };
  };

  const value: AuthContextValue = {
    user: session?.user ?? null,
    session,
    profile,
    loading,
    signIn,
    signUp,
    signInWithGoogle,
    signOut,
    resetPassword,
    refreshProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
