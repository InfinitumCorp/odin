import type { GeoCatalog } from "./dat.ts";

/**
 * Geo routing classifies an address for the ledger.
 * It does not change delivery, holding, approval, or where a message goes.
 */

export interface GeoAnnotation {
  line: string;
  country: string | null;
  categories: string[];
}

const IPV4 = /(?:^|[^0-9])((?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3})(?=[^0-9]|$)/g;
const IPV6 = /(?:^|[^0-9a-f:])((?:[0-9a-f]{0,4}:){2,7}[0-9a-f]{0,4})(?=[^0-9a-f:]|$)/gi;
const DOMAIN = /(?:^|[^a-z0-9-])((?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63})(?=[^a-z0-9.-]|$)/gi;

function first(text: string, pattern: RegExp): string | null {
  pattern.lastIndex = 0;
  const match = pattern.exec(text);
  return match?.[1] ?? null;
}

export function findIp(text: string): string | null {
  return first(text, IPV4) ?? first(text.toLowerCase(), IPV6);
}

export function findDomain(text: string): string | null {
  const match = first(text.toLowerCase(), DOMAIN);
  if (!match || match.length > 253) return null;
  return match;
}

export function classifyText(catalog: GeoCatalog, text: string): GeoAnnotation | null {
  const ip = findIp(text);
  const domain = findDomain(text);
  const country = ip ? catalog.countryOf(ip) : null;
  const categories = domain ? catalog.categoriesOf(domain) : [];
  const parts: string[] = [];
  if (ip && country) parts.push(`${ip} country ${country}`);
  if (domain && categories.length > 0) parts.push(`${domain} category ${categories.join(", ")}`);
  if (!parts.length) return null;
  return { line: `Geo routing: ${parts.join("; ")}.`, country, categories };
}
