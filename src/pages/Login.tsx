import { useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { APP_NAME } from "@/lib/constants";
import { loginReturnPath } from "@/lib/oauthNavigation";
import { useGoogleSignIn } from "@/hooks/useGoogleSignIn";

export default function Login() {
  const { data: googleEnabled = false } = useGoogleSignIn();
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const from = loginReturnPath((location.state as { from?: { pathname: string; search?: string } } | null)?.from);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await signIn(email, password);
      if (result.error) {
        setError(result.error);
        return;
      }
      navigate(from, { replace: true });
    } catch {
      setError("Could not reach the sign-in service. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Link to="/" className="mb-2 text-lg font-semibold">
            {APP_NAME}
          </Link>
          <CardTitle>Welcome back</CardTitle>
          <CardDescription>Sign in to manage your social accounts</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {googleEnabled && <><Button variant="outline" className="w-full" onClick={async () => { const result = await signInWithGoogle(from); if (result.error) setError(result.error); }} type="button">
            Continue with Google
          </Button>

          <div className="flex items-center gap-2">
            <Separator className="flex-1" />
            <span className="text-xs text-muted-foreground">or continue with</span>
            <Separator className="flex-1" />
          </div></>}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <Link to="/forgot-password" className="text-xs text-primary hover:underline">
                  Forgot password?
                </Link>
              </div>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Sign in
            </Button>
          </form>

          <p className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="font-medium text-primary hover:underline">
              Sign up
            </Link>
          </p>
          <p className="text-center text-xs text-muted-foreground"><Link to="/privacy" className="underline">Privacy policy</Link> · <Link to="/terms" className="underline">Terms of service</Link></p>
        </CardContent>
      </Card>
    </div>
  );
}
