import { isIP } from "node:net";

/**
 * Small reader for v2fly GeoIPList and GeoSiteList protobuf messages.
 * No protobuf package. Unknown fields are skipped.
 * GeoIP field 3 is inverse_match in the v2fly router proto.
 */

const textDecoder = new TextDecoder();

export interface GeoCatalog {
  countryOf(ip: string): string | null;
  countriesOf(ip: string): string[];
  codesOf(ip: string): string[];
  categoriesOf(domain: string): string[];
}

interface Range {
  start: number | bigint;
  end: number | bigint;
  prefix: number;
  code: string;
  index: number;
  v6: boolean;
}

interface InverseEntry {
  code: string;
  cidrs: { bytes: Uint8Array; prefix: number }[];
}

interface Field {
  field: number;
  wire: number;
  value?: number;
  start?: number;
  end?: number;
}

function readVarint(buf: Uint8Array, offset: number): [number, number] {
  let value = 0;
  let shift = 0;
  let pos = offset;
  while (pos < buf.length && shift <= 63) {
    const byte = buf[pos++]!;
    if (shift < 53) value += (byte & 0x7f) * 2 ** shift;
    if ((byte & 0x80) === 0) return [value, pos];
    shift += 7;
  }
  throw new Error("Truncated varint in geo data.");
}

function* fields(buf: Uint8Array, start: number, end: number): Generator<Field> {
  let pos = start;
  while (pos < end) {
    const [key, keyEnd] = readVarint(buf, pos);
    const field = key >>> 3;
    const wire = key & 7;
    pos = keyEnd;
    if (wire === 0) {
      const [value, after] = readVarint(buf, pos);
      yield { field, wire, value };
      pos = after;
      continue;
    }
    if (wire === 2) {
      const [length, after] = readVarint(buf, pos);
      const sliceEnd = after + length;
      if (sliceEnd > buf.length) throw new Error("Truncated geo message.");
      yield { field, wire, start: after, end: sliceEnd };
      pos = sliceEnd;
      continue;
    }
    if (wire === 5) {
      pos += 4;
    } else if (wire === 1) {
      pos += 8;
    } else {
      throw new Error(`Unsupported geo wire type ${wire}.`);
    }
    if (pos > end) throw new Error("Truncated geo message.");
  }
}

function text(buf: Uint8Array, start: number, end: number): string {
  return textDecoder.decode(buf.subarray(start, end));
}

export function parseIp(ip: string): Uint8Array | null {
  const trimmed = ip.trim().replace(/^\[|\]$/g, "");
  const kind = isIP(trimmed);
  if (kind === 4) {
    const parts = trimmed.split(".");
    if (parts.length !== 4) return null;
    return Uint8Array.from(parts.map((part) => Number(part)));
  }
  if (kind === 6) return ipv6Bytes(trimmed);
  return null;
}

function ipv6Bytes(address: string): Uint8Array | null {
  const zone = address.indexOf("%");
  const text = zone === -1 ? address : address.slice(0, zone);
  const halves = text.split("::");
  if (halves.length > 2) return null;
  const expand = (part: string): number[] | null => {
    if (!part) return [];
    const groups: number[] = [];
    for (const piece of part.split(":")) {
      if (piece.includes(".")) {
        const nums = piece.split(".").map((item) => Number(item));
        if (nums.length !== 4 || nums.some((item) => !Number.isInteger(item) || item < 0 || item > 255)) return null;
        groups.push(((nums[0]! << 8) | nums[1]!) & 0xffff, ((nums[2]! << 8) | nums[3]!) & 0xffff);
      } else {
        if (!/^[0-9a-fA-F]{1,4}$/.test(piece)) return null;
        groups.push(parseInt(piece, 16));
      }
    }
    return groups;
  };
  const left = expand(halves[0] ?? "");
  const right = halves.length === 2 ? expand(halves[1] ?? "") : [];
  if (!left || !right) return null;
  if (halves.length === 1) {
    if (left.length !== 8) return null;
  } else if (8 - (left.length + right.length) < 1) {
    return null;
  }
  const missing = 8 - (left.length + right.length);
  const groups = halves.length === 2 ? [...left, ...new Array<number>(missing).fill(0), ...right] : left;
  if (groups.length !== 8) return null;
  const bytes = new Uint8Array(16);
  groups.forEach((group, index) => {
    bytes[index * 2] = (group >> 8) & 0xff;
    bytes[index * 2 + 1] = group & 0xff;
  });
  return bytes;
}

function contains(ip: Uint8Array, network: Uint8Array, prefix: number): boolean {
  if (ip.length !== network.length) return false;
  const width = ip.length * 8;
  if (prefix < 0 || prefix > width) return false;
  let bits = prefix;
  for (let index = 0; index < ip.length && bits > 0; index += 1) {
    const take = Math.min(8, bits);
    const mask = take === 8 ? 0xff : (0xff << (8 - take)) & 0xff;
    if ((ip[index]! & mask) !== (network[index]! & mask)) return false;
    bits -= take;
  }
  return true;
}

function v4Bounds(bytes: Uint8Array, prefix: number): { start: number; end: number } {
  let ip = 0;
  for (const byte of bytes) ip = (ip * 256 + byte) >>> 0;
  if (prefix <= 0) return { start: 0, end: 0xffffffff };
  if (prefix >= 32) return { start: ip, end: ip };
  const mask = (0xffffffff << (32 - prefix)) >>> 0;
  const start = (ip & mask) >>> 0;
  const end = (start | (~mask >>> 0)) >>> 0;
  return { start, end };
}

function v6Bounds(bytes: Uint8Array, prefix: number): { start: bigint; end: bigint } {
  let ip = 0n;
  for (const byte of bytes) ip = (ip << 8n) | BigInt(byte);
  const all = (1n << 128n) - 1n;
  if (prefix <= 0) return { start: 0n, end: all };
  if (prefix >= 128) return { start: ip, end: ip };
  const host = (1n << BigInt(128 - prefix)) - 1n;
  const start = ip & (all ^ host);
  return { start, end: start | host };
}

function encodeVarint(value: number): Uint8Array {
  const bytes: number[] = [];
  let rest = value >>> 0;
  while (rest > 0x7f) {
    bytes.push((rest & 0x7f) | 0x80);
    rest >>>= 7;
  }
  bytes.push(rest);
  return Uint8Array.from(bytes);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const size = parts.reduce((sum, part) => sum + part.length, 0);
  const out = new Uint8Array(size);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function fieldBytes(field: number, wire: number, data: Uint8Array): Uint8Array {
  return concat([encodeVarint((field << 3) | wire), encodeVarint(data.length), data]);
}

function fieldString(field: number, value: string): Uint8Array {
  return fieldBytes(field, 2, new TextEncoder().encode(value));
}

function fieldVarint(field: number, value: number): Uint8Array {
  return concat([encodeVarint((field << 3) | 0), encodeVarint(value)]);
}

export interface FixtureCidr {
  ip: string;
  prefix: number;
}

export interface FixtureGeoIp {
  code: string;
  cidrs: FixtureCidr[];
  inverse?: boolean;
}

export interface FixtureDomain {
  type: "plain" | "regex" | "domain" | "full";
  value: string;
  attrs?: { key: string; bool?: boolean; int?: number }[];
}

export interface FixtureGeoSite {
  code: string;
  domains: FixtureDomain[];
}

const DOMAIN_TYPE = { plain: 0, regex: 1, domain: 2, full: 3 } as const;

export function encodeGeoIpList(entries: FixtureGeoIp[]): Uint8Array {
  return concat(entries.map((entry) => {
    const cidrs = entry.cidrs.map((cidr) => {
      const bytes = parseIp(cidr.ip);
      if (!bytes) throw new Error(`Cannot encode ${cidr.ip}.`);
      return fieldBytes(2, 2, concat([fieldBytes(1, 2, bytes), fieldVarint(2, cidr.prefix)]));
    });
    const body = concat([
      fieldString(1, entry.code),
      ...cidrs,
      ...(entry.inverse ? [fieldVarint(3, 1)] : []),
    ]);
    return fieldBytes(1, 2, body);
  }));
}

export function encodeGeoSiteList(entries: FixtureGeoSite[]): Uint8Array {
  return concat(entries.map((entry) => {
    const domains = entry.domains.map((domain) => {
      const attrs = (domain.attrs ?? []).map((attr) => {
        const parts = [fieldString(1, attr.key)];
        if (attr.bool !== undefined) parts.push(fieldVarint(2, attr.bool ? 1 : 0));
        if (attr.int !== undefined) parts.push(fieldVarint(3, attr.int));
        return fieldBytes(3, 2, concat(parts));
      });
      return fieldBytes(2, 2, concat([fieldVarint(1, DOMAIN_TYPE[domain.type]), fieldString(2, domain.value), ...attrs]));
    });
    return fieldBytes(1, 2, concat([fieldString(1, entry.code), ...domains]));
  }));
}

export function loadGeoCatalog(geoip: Uint8Array, geosite: Uint8Array): GeoCatalog {
  const v4: Range[][] = [];
  const v6: Range[][] = [];
  const wide: Range[] = [];
  const inverse: InverseEntry[] = [];
  let index = 0;

  const addRange = (range: Range, bucketOf: (value: number | bigint) => number) => {
    const first = bucketOf(range.start);
    const last = bucketOf(range.end);
    if (last - first > 512) {
      wide.push(range);
      return;
    }
    const table = range.v6 ? v6 : v4;
    for (let bucket = first; bucket <= last; bucket += 1) {
      const list = table[bucket] ?? (table[bucket] = []);
      list.push(range);
    }
  };

  for (const entry of fields(geoip, 0, geoip.length)) {
    if (entry.field !== 1 || entry.wire !== 2 || entry.start === undefined || entry.end === undefined) continue;
    let code = "";
    let inverseMatch = false;
    const cidrs: { bytes: Uint8Array; prefix: number }[] = [];
    for (const field of fields(geoip, entry.start, entry.end)) {
      if (field.field === 1 && field.wire === 2 && field.start !== undefined && field.end !== undefined) {
        code = text(geoip, field.start, field.end);
      } else if (field.field === 3 && field.wire === 0) {
        inverseMatch = field.value === 1;
      } else if (field.field === 2 && field.wire === 2 && field.start !== undefined && field.end !== undefined) {
        let bytes = new Uint8Array();
        let prefix = 0;
        for (const inner of fields(geoip, field.start, field.end)) {
          if (inner.field === 1 && inner.wire === 2 && inner.start !== undefined && inner.end !== undefined) {
            bytes = geoip.subarray(inner.start, inner.end);
          } else if (inner.field === 2 && inner.wire === 0 && inner.value !== undefined) {
            prefix = inner.value;
          }
        }
        if (bytes.length === 4 || bytes.length === 16) cidrs.push({ bytes, prefix });
      }
    }
    if (!code) continue;
    if (inverseMatch) {
      inverse.push({ code, cidrs });
      continue;
    }
    for (const cidr of cidrs) {
      if (cidr.bytes.length === 4) {
        const bounds = v4Bounds(cidr.bytes, cidr.prefix);
        addRange({ ...bounds, prefix: cidr.prefix, code, index, v6: false }, (value) => Number(value) >>> 16);
      } else {
        const bounds = v6Bounds(cidr.bytes, cidr.prefix);
        addRange({ ...bounds, prefix: cidr.prefix, code, index, v6: true }, (value) => Number((value as bigint) >> 112n));
      }
      index += 1;
    }
  }

  const full = new Map<string, string[]>();
  const roots = new Map<string, string[]>();
  const plain: { value: string; code: string }[] = [];
  const regexes: { re: RegExp; code: string }[] = [];

  const push = (map: Map<string, string[]>, key: string, code: string) => {
    const list = map.get(key);
    if (list) {
      if (!list.includes(code)) list.push(code);
    } else {
      map.set(key, [code]);
    }
  };

  for (const entry of fields(geosite, 0, geosite.length)) {
    if (entry.field !== 1 || entry.wire !== 2 || entry.start === undefined || entry.end === undefined) continue;
    let code = "";
    const domains: { type: number; value: string }[] = [];
    for (const field of fields(geosite, entry.start, entry.end)) {
      if (field.field === 1 && field.wire === 2 && field.start !== undefined && field.end !== undefined) {
        code = text(geosite, field.start, field.end);
      } else if (field.field === 2 && field.wire === 2 && field.start !== undefined && field.end !== undefined) {
        let type = 0;
        let value = "";
        for (const inner of fields(geosite, field.start, field.end)) {
          if (inner.field === 1 && inner.wire === 0 && inner.value !== undefined) type = inner.value;
          else if (inner.field === 2 && inner.wire === 2 && inner.start !== undefined && inner.end !== undefined) {
            value = text(geosite, inner.start, inner.end);
          }
        }
        if (value) domains.push({ type, value: type === 1 ? value : value.toLowerCase() });
      }
    }
    if (!code) continue;
    for (const domain of domains) {
      if (domain.type === 3) push(full, domain.value, code);
      else if (domain.type === 2) push(roots, domain.value, code);
      else if (domain.type === 1) {
        if (domain.value.length > 512) continue;
        try {
          regexes.push({ re: new RegExp(domain.value), code });
        } catch {
          // A bad pattern in a fixture is ignored. The rest of the list still loads.
        }
      } else {
        plain.push({ value: domain.value, code });
      }
    }
  }

  function forward(ip: string): Range[] {
    const bytes = parseIp(ip);
    if (!bytes) return [];
    if (bytes.length === 4) {
      const bounds = v4Bounds(bytes, 32);
      const hits: Range[] = [];
      const bucket = v4[bounds.start >>> 16];
      if (bucket) {
        for (const range of bucket) {
          if (!range.v6 && bounds.start >= (range.start as number) && bounds.start <= (range.end as number)) hits.push(range);
        }
      }
      for (const range of wide) {
        if (!range.v6 && bounds.start >= (range.start as number) && bounds.start <= (range.end as number)) hits.push(range);
      }
      return hits;
    }
    const bounds = v6Bounds(bytes, 128);
    const hits: Range[] = [];
    const bucket = v6[Number(bounds.start >> 112n)];
    if (bucket) {
      for (const range of bucket) {
        if (range.v6 && bounds.start >= (range.start as bigint) && bounds.start <= (range.end as bigint)) hits.push(range);
      }
    }
    for (const range of wide) {
      if (range.v6 && bounds.start >= (range.start as bigint) && bounds.start <= (range.end as bigint)) hits.push(range);
    }
    return hits;
  }

  function ordered(ranges: Range[]): string[] {
    return [...ranges].sort((a, b) => b.prefix - a.prefix || a.index - b.index).map((range) => range.code).filter((code, offset, all) => all.indexOf(code) === offset);
  }

  function inverseCodes(ip: string): string[] {
    const bytes = parseIp(ip);
    if (!bytes) return [];
    const codes: string[] = [];
    for (const entry of inverse) {
      const hit = entry.cidrs.some((cidr) => contains(bytes, cidr.bytes, cidr.prefix));
      if (!hit && !codes.includes(entry.code)) codes.push(entry.code);
    }
    return codes;
  }

  return {
    countryOf(ip: string): string | null {
      return ordered(forward(ip))[0] ?? null;
    },
    countriesOf(ip: string): string[] {
      return ordered(forward(ip));
    },
    codesOf(ip: string): string[] {
      return [...ordered(forward(ip)), ...inverseCodes(ip)];
    },
    categoriesOf(domain: string): string[] {
      const host = domain.trim().toLowerCase().replace(/\.$/, "");
      if (!host || host.length > 253) return [];
      const found: string[] = [];
      const add = (list: string[] | undefined) => {
        if (!list) return;
        for (const code of list) if (!found.includes(code)) found.push(code);
      };
      add(full.get(host));
      const labels = host.split(".");
      for (let offset = 0; offset < labels.length; offset += 1) add(roots.get(labels.slice(offset).join(".")));
      for (const rule of plain) if (host.includes(rule.value)) add([rule.code]);
      for (const rule of regexes) if (rule.re.test(host)) add([rule.code]);
      return found;
    },
  };
}
