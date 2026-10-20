import { useQuery } from "@tanstack/react-query";
import { supabasePublicConfig } from "@/lib/supabase";
import { googleSignInEnabled } from "@/lib/authProviders";

export function useGoogleSignIn() {
  return useQuery({
    queryKey: ["google-sign-in-availability", supabasePublicConfig.url],
    queryFn: () => googleSignInEnabled(supabasePublicConfig.url, supabasePublicConfig.key),
    staleTime: 5 * 60 * 1000,
    retry: 1,
  });
}
