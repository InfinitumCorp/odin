import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { encodeGeoIpList, encodeGeoSiteList, loadGeoCatalog } from "./dat.ts";
import { classifyText } from "./policy.ts";

const geoip = encodeGeoIpList([
  { code: "TEN", cidrs: [{ ip: "10.0.0.0", prefix: 8 }] },
  { code: "INNER", cidrs: [{ ip: "10.1.0.0", prefix: 16 }] },
  { code: "ZZ", cidrs: [{ ip: "203.0.113.0", prefix: 24 }] },
  { code: "AA", cidrs: [{ ip: "2001:db8::", prefix: 32 }] },
  { code: "OUT", cidrs: [{ ip: "203.0.113.0", prefix: 24 }], inverse: true },
]);

const geosite = encodeGeoSiteList([
  {
    code: "example",
    domains: [{ type: "domain", value: "example.test", attrs: [{ key: "attr", bool: true, int: 7 }] }],
  },
  { code: "exact", domains: [{ type: "full", value: "exact.example.test" }] },
  { code: "keyword", domains: [{ type: "plain", value: "keyword" }] },
  { code: "re", domains: [{ type: "regex", value: String.raw`^re\.example\.test$` }] },
  { code: "broken", domains: [{ type: "regex", value: "(" }] },
]);

describe("v2fly geo dat", () => {
  const catalog = loadGeoCatalog(geoip, geosite);

  it("maps an IP to the most specific country and keeps inverse lists apart", () => {
    assert.equal(catalog.countryOf("10.1.2.3"), "INNER");
    assert.deepEqual(catalog.countriesOf("10.1.2.3"), ["INNER", "TEN"]);
    assert.equal(catalog.countryOf("203.0.113.10"), "ZZ");
    assert.equal(catalog.countryOf("198.51.100.8"), null);
    assert.deepEqual(catalog.codesOf("203.0.113.10"), ["ZZ"]);
    assert.deepEqual(catalog.codesOf("198.51.100.8"), ["OUT"]);
    assert.equal(catalog.countryOf("2001:db8::1"), "AA");
    assert.equal(catalog.countryOf("2001:db9::1"), null);
    assert.equal(catalog.countryOf("not-an-ip"), null);
  });

  it("maps a domain to categories using full, root, plain, and regex rules", () => {
    assert.deepEqual(catalog.categoriesOf("exact.example.test"), ["exact", "example"]);
    assert.deepEqual(catalog.categoriesOf("www.example.test"), ["example"]);
    assert.deepEqual(catalog.categoriesOf("notexample.test"), []);
    assert.deepEqual(catalog.categoriesOf("example.test.evil"), []);
    assert.deepEqual(catalog.categoriesOf("mykeyword.test"), ["keyword"]);
    assert.deepEqual(catalog.categoriesOf("re.example.test"), ["example", "re"]);
    assert.deepEqual(catalog.categoriesOf("nore.example.test"), ["example"]);
  });

  it("classifies text without inventing a match", () => {
    const both = classifyText(catalog, "mail 203.0.113.10 via www.example.test");
    assert.equal(both?.country, "ZZ");
    assert.deepEqual(both?.categories, ["example"]);
    assert.equal(both?.line, "Geo routing: 203.0.113.10 country ZZ; www.example.test category example.");
    assert.equal(classifyText(catalog, "Harbor Civil"), null);
    assert.equal(loadGeoCatalog(new Uint8Array(), new Uint8Array()).countryOf("203.0.113.10"), null);
  });

  it("rejects a truncated dataset", () => {
    assert.throws(() => loadGeoCatalog(new Uint8Array([0x80]), new Uint8Array()), /varint/);
  });
});
