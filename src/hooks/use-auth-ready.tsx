import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type AuthReadyState = {
  user: User | null;
  isReady: boolean;
};

export function useAuthReady(): AuthReadyState {
  const [state, setState] = useState<AuthReadyState>({ user: null, isReady: false });

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setState({ user: data.session?.user ?? null, isReady: true });
    });

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setState((current) => ({
        user: session?.user ?? null,
        isReady: current.isReady,
      }));
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  return state;
}