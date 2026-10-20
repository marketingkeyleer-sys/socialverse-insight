import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResetPassword() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8 || password !== confirm) { setError("Use at least 8 characters and matching passwords"); return; }
    setSaving(true); setError("");
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      await signOut();
      navigate("/login", { replace: true });
    } catch (failure) { setError(failure instanceof Error ? failure.message : "Could not reset password"); }
    finally { setSaving(false); }
  };
  return <div className="grid min-h-screen place-items-center bg-muted/30 p-4"><Card className="w-full max-w-sm">
    <CardHeader><CardTitle>Set a new password</CardTitle></CardHeader>
    <CardContent>{loading ? <p>Checking recovery link…</p> : !user ? <p>This recovery link is invalid or expired. <Link to="/forgot-password" className="text-primary underline">Request a new link</Link></p> :
      <form onSubmit={save} className="space-y-4">
        <label className="block text-sm">New password<Input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} /></label>
        <label className="block text-sm">Confirm password<Input type="password" autoComplete="new-password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} /></label>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={saving}>{saving ? "Saving…" : "Reset password"}</Button>
      </form>}
    </CardContent>
  </Card></div>;
}
