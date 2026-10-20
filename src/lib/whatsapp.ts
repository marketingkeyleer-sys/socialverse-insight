import type { ConnectedAccount, WhatsAppOptions } from "@/types/database";

// Why a post's WhatsApp settings can't be sent yet, or null when they can.
export function isWhatsAppReady(account: ConnectedAccount | undefined, options: WhatsAppOptions): string | null {
  if (!account) return "Connect a WhatsApp number first";
  if (account.metadata?.mode === "bridge") {
    return options.includeContacts || (options.groups?.length ?? 0) > 0
      ? null
      : "Pick who gets this on WhatsApp: your contacts, a group, or both";
  }
  return options.templateName ? null : "Pick an approved WhatsApp template";
}

export interface ParsedContact {
  phone: string;
  name: string | null;
  tags: string[];
}

export interface ParseResult {
  rows: ParsedContact[];
  invalid: string[];
  duplicates: number;
}

// WhatsApp needs the full international number with no "+" or spaces. A bare
// local number only gets the default country code when the user supplied one
// — guessing a country for them would silently message the wrong people.
export function normalizePhone(raw: string, defaultCountryCode: string): string | null {
  const trimmed = raw.trim();
  const hadPlus = trimmed.startsWith("+") || trimmed.startsWith("00");
  let digits = trimmed.replace(/[^0-9]/g, "");
  if (trimmed.startsWith("00")) digits = digits.slice(2);
  const cc = defaultCountryCode.replace(/[^0-9]/g, "");
  if (!hadPlus && cc && digits.length <= 10) digits = cc + digits.replace(/^0+/, "");
  return /^[0-9]{8,15}$/.test(digits) ? digits : null;
}

// One contact per line: phone, name, tags — comma or tab separated (so a
// pasted spreadsheet selection works), tags separated by ";" or "|".
export function parseContactLines(input: string, defaultCountryCode: string): ParseResult {
  const rows: ParsedContact[] = [];
  const invalid: string[] = [];
  const seen = new Set<string>();
  let duplicates = 0;

  for (const line of input.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const [phoneRaw, nameRaw, tagsRaw] = line.split(/[,\t]/).map((p) => p.trim());
    const phone = normalizePhone(phoneRaw ?? "", defaultCountryCode);
    // A header row like "phone,name,tags" would otherwise be reported as junk.
    if (!phone) {
      if (!/^(phone|mobile|number|whatsapp)/i.test(phoneRaw ?? "")) invalid.push(line.trim());
      continue;
    }
    if (seen.has(phone)) {
      duplicates += 1;
      continue;
    }
    seen.add(phone);
    rows.push({
      phone,
      name: nameRaw || null,
      tags: (tagsRaw ?? "")
        .split(/[;|]/)
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean),
    });
  }
  return { rows, invalid, duplicates };
}

// WhatsApp Business can't post into groups through any official API, so
// group sharing hands the finished post to the user's own WhatsApp (app or
// web), where they pick the group. Media can't ride along in a wa.me link,
// so its URL is appended to the text — WhatsApp renders it as a preview.
export function buildGroupShareUrl(content: string, mediaUrls: string[]): string {
  const text = [content.trim(), ...mediaUrls].filter(Boolean).join("\n\n");
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}
