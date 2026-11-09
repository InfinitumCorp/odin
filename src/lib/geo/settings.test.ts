import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { runGeoCli } from "../../cli.ts";
import { encodeGeoIpList, encodeGeoSiteList } from "./dat.ts";
import { createLiveGeoRouter } from "./router.ts";
import {
  currentGeoEnv,
  defaultGeoPaths,
  effectiveGeoRouting,
  noteGeoEnv,
  readGeoRouting,
  resetGeoEnvForTests,
  resolveGeoEnabled,
  writeGeoRouting,
} from "./settings.ts";

describe("geo routing switch", () => {
  it("ships off, persists a local choice, and lets the env override it", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "odin-geo-settings-"));
    const settingsPath = path.join(dir, "settings.json");
    const configPath = path.join(dir, "config.json");
    await writeFile(configPath, `${JSON.stringify({ geoRouting: false })}\n`);
    assert.equal(await readGeoRouting({ settingsPath, configPath }), false);
    assert.equal(await readGeoRouting({ settingsPath: path.join(dir, "missing.json"), configPath: defaultGeoPaths().configPath }), false);
    await writeGeoRouting(true, settingsPath);
    assert.equal(await readGeoRouting({ settingsPath, configPath }), true);
    assert.equal(resolveGeoEnabled(undefined, true), true);
    assert.equal(resolveGeoEnabled("off", true), false);
    assert.equal(resolveGeoEnabled("on", false), true);
    assert.equal(resolveGeoEnabled("maybe", true), false);
    assert.equal(await effectiveGeoRouting({ settingsPath, configPath, env: "off" }), false);
    await writeFile(settingsPath, "{not json");
    assert.equal(await readGeoRouting({ settingsPath, configPath }), false);
  });

  it("loads datasets only while the switch is on", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "odin-geo-router-"));
    const settingsPath = path.join(dir, "settings.json");
    const configPath = path.join(dir, "config.json");
    const dataDir = path.join(dir, "geo");
    await writeFile(configPath, `${JSON.stringify({ geoRouting: false })}\n`);
    await mkdir(dataDir);
    await writeFile(path.join(dataDir, "geoip.dat"), encodeGeoIpList([{ code: "ZZ", cidrs: [{ ip: "203.0.113.0", prefix: 24 }] }]));
    await writeFile(path.join(dataDir, "geosite.dat"), encodeGeoSiteList([{ code: "example", domains: [{ type: "domain", value: "example.test" }] }]));
    const paths = { settingsPath, configPath, dataDir, env: undefined };
    const router = createLiveGeoRouter(paths);
    assert.equal(await router.annotate("203.0.113.10 www.example.test"), null);
    await writeGeoRouting(true, settingsPath);
    const hit = await router.annotate("203.0.113.10 www.example.test");
    assert.match(hit?.line ?? "", /203\.0\.113\.10 country ZZ/);
    assert.match(hit?.line ?? "", /www\.example\.test category example/);
    assert.equal(await createLiveGeoRouter({ ...paths, env: "off" }).annotate("203.0.113.10"), null);
    const bare = await mkdtemp(path.join(tmpdir(), "odin-geo-empty-"));
    const empty = createLiveGeoRouter({ settingsPath: path.join(bare, "settings.json"), configPath, dataDir: bare, env: "on" });
    assert.equal(await empty.annotate("203.0.113.10"), null);
  });

  it("toggles geo routing from the CLI and reports the saved state", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "odin-geo-cli-"));
    const paths = {
      settingsPath: path.join(dir, "settings.json"),
      configPath: path.join(dir, "config.json"),
      dataDir: path.join(dir, "geo"),
      env: undefined,
    };
    await writeFile(paths.configPath, `${JSON.stringify({ geoRouting: false })}\n`);
    const on = await runGeoCli(["--geo", "on"], paths);
    assert.equal(on.code, 0);
    assert.match(on.text, /Geo routing is on\./);
    assert.match(on.text, /Saved setting: on\./);
    assert.match(on.text, /geoip\.dat missing/);
    const off = await runGeoCli(["--geo", "off"], paths);
    assert.match(off.text, /Geo routing is off\./);
    assert.equal(await readGeoRouting(paths), false);
    const bad = await runGeoCli(["--geo", "maybe"], paths);
    assert.equal(bad.code, 1);
    const forced = await runGeoCli(["--geo", "status"], { ...paths, env: "on" });
    assert.match(forced.text, /Geo routing is on\./);
    assert.match(forced.text, /Saved setting: off\./);
    assert.match(forced.text, /INFINITUM_GEO_ENABLED: on/);
  });

  it("accepts a worker binding without keeping it after reset", () => {
    resetGeoEnvForTests();
    noteGeoEnv("on");
    assert.equal(currentGeoEnv(), "on");
    noteGeoEnv("");
    assert.equal(currentGeoEnv(), undefined);
    resetGeoEnvForTests();
  });
});
