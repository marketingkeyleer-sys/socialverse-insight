import { FunctionsHttpError } from "@supabase/supabase-js";
export async function functionError(error: unknown, fallback: string): Promise<string> {
  if (error instanceof FunctionsHttpError) {
    const body = await error.context.clone().json().catch(() => null);
    if (typeof body?.error === "string") return body.error;
  }
  return error instanceof Error ? error.message : fallback;
}
