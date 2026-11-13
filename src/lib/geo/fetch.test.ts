import assert from "node:assert/strict";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import {
  allowedDownloadHost,
  assertChecksum,
  assertV2flyEntry,
  fetchGeoDatasets,
  GeoChecksumError,
  parseSha256Sum,
  readLock,
  sha256,
  type GeoLockEntry,
} from "../../../scripts/fetch-geo.ts";
import { encodeGeoIpList } from "./dat.ts";

const GEOIP_SUM = "eedb24b3b9fcba27e06b92c0428dab90d9496083091ae4cf39e11387fd99d0e2  geoip.dat\n";
const GEOSITE_SUM = "dc4192dd1b644a38276ed06136d26e729fa674d25785adb38c87e040e92376b2  dlc.dat\n";

describe("geo fetch lock", () => {
  it("locks the official v2fly checksums and refuses other builds", async () => {
    const lock = await readLock();
    assert.deepEqual(lock.excluded, ["Loyalsoldier", "sing-box"]);
    assert.equal(lock.datasets[0]?.sha256, parseSha256Sum(GEOIP_SUM, "geoip.dat"));
    assert.equal(lock.datasets[1]?.sha256, parseSha256Sum(GEOSITE_SUM, "dlc.dat"));
    assert.equal(lock.datasets[1]?.asset, "dlc.dat");
    assert.equal(lock.datasets[1]?.file, "geosite.dat");
    const entry = lock.datasets[0];
    if (!entry) throw new Error("missing geoip lock");
    assert.throws(() => assertV2flyEntry({ ...entry, url: entry.url.replace("v2fly/geoip", "Loyalsoldier/v2ray-rules-dat") }), /Loyalsoldier/);
    assert.throws(() => assertV2flyEntry({ ...entry, project: "SagerNet/sing-box" }), /sing-box/);
    assert.equal(allowedDownloadHost("release-assets.githubusercontent.com"), true);
    assert.equal(allowedDownloadHost("downloads.example"), false);
  });

  it("does not save a dataset when the checksum does not match", async () => {
    const lock = await readLock();
    const dir = await mkdtemp(path.join(tmpdir(), "odin-geo-fetch-"));
    const entry = lock.datasets[0];
    if (!entry) throw new Error("missing geoip lock");
    let bodies = 0;
    await assert.rejects(
      () => fetchGeoDatasets({
        lock: { ...lock, datasets: [entry] },
        outDir: dir,
        fetchBytes: async (url) => {
          if (url.endsWith(".sha256sum")) return new TextEncoder().encode(`${"a".repeat(64)}  ${entry.asset}\n`);
          bodies += 1;
          return new Uint8Array([1, 2, 3]);
        },
      }),
      (error: unknown) => error instanceof GeoChecksumError && /Checksum mismatch/.test(error.message) && /was not saved/.test(error.message),
    );
    assert.equal(bodies, 0);
    assert.deepEqual(await readdir(dir), []);

    const bytes = new Uint8Array([9, 8, 7]);
    assert.throws(
      () => assertChecksum({ asset: entry.asset, officialText: `${entry.sha256}  ${entry.asset}\n`, lockHash: entry.sha256, bytes }),
      /Downloaded sha256/,
    );
  });

  it("saves a verified fixture under the locked file name", async () => {
    const lock = await readLock();
    const source = lock.datasets[0];
    if (!source) throw new Error("missing geoip lock");
    const bytes = encodeGeoIpList([{ code: "ZZ", cidrs: [{ ip: "203.0.113.9", prefix: 32 }] }]);
    const hash = sha256(bytes);
    const entry: GeoLockEntry = { ...source, sha256: hash };
    const dir = await mkdtemp(path.join(tmpdir(), "odin-geo-save-"));
    const saved = await fetchGeoDatasets({
      lock: { ...lock, datasets: [entry] },
      outDir: dir,
      fetchBytes: async (url) => {
        if (url.endsWith(".sha256sum")) return new TextEncoder().encode(`${hash}  ${entry.asset}\n`);
        return bytes;
      },
    });
    assert.equal(saved[0], path.join(dir, "geoip.dat"));
    assert.deepEqual((await readdir(dir)).sort(), ["geoip.dat"]);
  });
});
