export async function googleSignInEnabled(url: string, publicKey: string, request: typeof fetch = fetch): Promise<boolean> {
  const response = await request(`${url.replace(/\/$/, "")}/auth/v1/settings`, { headers: { apikey: publicKey } });
  if (!response.ok) throw new Error("Sign-in options could not be loaded");
  const settings = await response.json();
  return settings?.external?.google === true;
}
