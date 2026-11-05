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

  it("updates the picture when an approved course is finished", async () => {
    const odin = await createOdin();
    const drafted = await odin.draft("analyst");
    assert.equal(drafted.ok, true);
    const course = drafted.picture.courses.find((item) => !isRedacted(item) && item.title.includes("Harbor"));
    if (!course || isRedacted(course)) throw new Error("course missing");
    const approved = await odin.decide("commander", course.id, "approve");
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    let picture = approved.picture;
    const tasks = picture.tasks.filter((item) => !isRedacted(item) && item.courseId === course.id);
    assert.ok(tasks.length >= 1);
    for (const task of tasks) {
      const step = await odin.advanceTask("analyst", task.id, "done");
      assert.equal(step.ok, true);
      if (step.ok) picture = step.picture;
    }
    const settled = picture.courses.find((item) => item.id === course.id);
    if (!settled || isRedacted(settled)) throw new Error("settled course missing");
    assert.equal(settled.status, "complete");
    const harbor = picture.partners.find((item) => !isRedacted(item) && item.name === "Harbor Civil");
    if (!harbor || isRedacted(harbor)) throw new Error("harbor missing");
    assert.equal(harbor.status, "Current");
    assert.ok(picture.traffic.some((item) => !isRedacted(item) && item.body.includes("On the net")));
    assert.equal((await odin.verify()).ok, true);
  });

  it("files a commander note the observer cannot read", async () => {
    const odin = await createOdin();
    const filed = await odin.observe("commander", "Tunnel mouth is clear.");
    assert.equal(filed.ok, true);
    const visible = filed.picture.observations.find((item) => !isRedacted(item));
    if (!visible || isRedacted(visible)) throw new Error("note missing");
    assert.match(visible.note, /Tunnel mouth/);
    const observer = await odin.picture("observer");
    const hidden = observer.observations.find((item) => item.id === visible.id);
    assert.ok(hidden && isRedacted(hidden));
    assert.equal((await odin.verify()).ok, true);
  });

  it("answers from the picture and does not invent a weapon", async () => {
    const odin = await createOdin();
    const scene = await odin.ask("commander", "What is happening with the depot vehicle?");
    assert.match(scene.answer, /roster/i);
    assert.doesNotMatch(scene.answer, /weapon|strike|engage/i);
  });
});
