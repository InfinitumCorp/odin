import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createOdin } from "./service.ts";
import { isRedacted } from "./types.ts";

describe("ODIN° exercise backend", () => {
  it("withholds secret tracks from an observer and keeps the ledger intact", async () => {
    const odin = await createOdin({ now: () => new Date("2026-11-05T00:00:00Z") });
    const picture = await odin.picture("observer");
    const depot = picture.tracks.find((track) => track.id === "trk-depot");
    assert.ok(depot);
    assert.equal(isRedacted(depot), true);
    assert.equal(picture.ledgerOk, true);
    assert.ok(picture.ledgerLength >= 3);
    const truck = picture.tracks.find((track) => track.id === "trk-truck");
    assert.ok(truck && !isRedacted(truck));
    assert.match(truck.note, /roster/);
  });

  it("refuses analyst approval, then lets the commander task a course", async () => {
    let now = new Date("2026-11-05T00:00:00Z");
    const odin = await createOdin({ now: () => now });
    now = new Date("2026-11-05T00:00:20Z");
    const before = await odin.picture("commander");
    assert.ok(before.alerts.some((alert) => !isRedacted(alert) && alert.id === "alt-depot"));

    const denied = await odin.decide("analyst", "missing", "approve");
    assert.equal(denied.ok, false);

    const drafted = await odin.draft("analyst");
    assert.equal(drafted.ok, true);
    assert.ok(drafted.drafted >= 1);
    const course = drafted.picture.courses.find((item) => !isRedacted(item) && item.status === "draft");
    assert.ok(course);

    const blocked = await odin.decide("analyst", course.id, "approve");
    assert.equal(blocked.ok, false);
    assert.match(blocked.error, /commander/);

    const approved = await odin.decide("commander", course.id, "approve", "Approved for the exercise.");
    assert.equal(approved.ok, true);
    assert.ok(approved.picture.tasks.some((task) => !isRedacted(task)));
    const verify = await odin.verify();
    assert.equal(verify.ok, true);

    const observer = await odin.picture("observer");
    assert.ok(observer.courses.some((item) => isRedacted(item)));
  });

  it("answers from the picture and does not invent a weapon", async () => {
    const odin = await createOdin();
    const scene = await odin.ask("commander", "What is happening with the depot vehicle?");
    assert.match(scene.answer, /roster/i);
    assert.doesNotMatch(scene.answer, /weapon|strike|engage/i);
  });
});
