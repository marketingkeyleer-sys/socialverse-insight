import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { supabase } from "@/lib/supabase";
import { TIMEZONES } from "@/lib/constants";

export function ProfileForm() {
  const { profile, user } = useAuth();
  const { updateProfile } = useProfile();
  const [fullName, setFullName] = useState(profile?.full_name ?? "");
  const [timezone, setTimezone] = useState(profile?.timezone ?? "Asia/Kolkata");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? "");
  const [uploading, setUploading] = useState(false);

  // profile loads asynchronously after this component's first render, so
  // the useState initializers above miss it — this re-syncs the form once
  // the real data actually arrives, instead of staying stuck on the
  // pre-load defaults (full name showing blank even when one is set).
  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name ?? "");
    setTimezone(profile.timezone ?? "Asia/Kolkata");
    setAvatarUrl(profile.avatar_url ?? "");
  }, [profile]);

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() ?? "png";
      const path = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from("sv-avatars").upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from("sv-avatars").getPublicUrl(path);
      setAvatarUrl(`${data.publicUrl}?t=${Date.now()}`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Avatar upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    updateProfile.mutate({ full_name: fullName, timezone, avatar_url: avatarUrl || null });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar className="h-16 w-16">
          <AvatarImage src={avatarUrl || undefined} alt={fullName} />
          <AvatarFallback>{(fullName || "U").slice(0, 1).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div>
          <Label htmlFor="avatar-upload" className="cursor-pointer text-sm font-medium text-primary">
            {uploading ? "Uploading…" : "Change avatar"}
          </Label>
          <input
            id="avatar-upload"
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files?.[0] && handleAvatarUpload(e.target.files[0])}
          />
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="full-name">Full name</Label>
        <Input id="full-name" value={fullName} onChange={(e) => setFullName(e.target.value)} />
      </div>

      <div className="space-y-1.5">
        <Label>Email</Label>
        <Input value={profile?.email ?? ""} disabled />
      </div>

      <div className="space-y-1.5">
        <Label>Timezone</Label>
        <Select value={timezone} onValueChange={setTimezone}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TIMEZONES.map((tz) => (
              <SelectItem key={tz} value={tz}>
                {tz}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Button onClick={handleSave} disabled={updateProfile.isPending}>
        {updateProfile.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Save changes
      </Button>
    </div>
  );
}
