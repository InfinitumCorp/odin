import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createOdin } from "./service.ts";
import { projectFeeds } from "./feeds.ts";
import { CNDCTR_ACTIONS, handleCndctrRequest } from "./cndctr.ts";
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

  it("holds a message until the east relay is restored", async () => {
    const odin = await createOdin();
    const sent = await odin.sendTraffic("analyst", "LANTERN-3", "Status check only.");
    assert.equal(sent.ok, true);
    if (!sent.ok) return;
    const held = sent.picture.traffic.find((item) => !isRedacted(item) && item.body.includes("Status check"));
    if (!held || isRedacted(held)) throw new Error("message missing");
    assert.equal(held.held, true);

    const drafted = await odin.draft("analyst");
    assert.equal(drafted.ok, true);
    const course = drafted.picture.courses.find((item) => !isRedacted(item) && item.title.includes("east relay"));
    if (!course || isRedacted(course)) throw new Error("relay course missing");
    const approved = await odin.decide("commander", course.id, "approve");
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    let picture = approved.picture;
    const tasks = picture.tasks.filter((item) => !isRedacted(item) && item.courseId === course.id);
    for (const task of tasks) {
      const step = await odin.advanceTask("analyst", task.id, "done");
      assert.equal(step.ok, true);
      if (step.ok) picture = step.picture;
    }
    const released = picture.traffic.find((item) => item.id === held.id);
    if (!released || isRedacted(released)) throw new Error("released message missing");
    assert.equal(released.held, false);
    assert.equal(picture.systems.find((item) => item.id === "aether")?.state, "nominal");
    const again = await odin.sendTraffic("analyst", "LANTERN-3", "Second check.");
    assert.equal(again.ok, true);
    if (!again.ok) return;
    const next = again.picture.traffic.find((item) => !isRedacted(item) && item.body === "Second check.");
    if (!next || isRedacted(next)) throw new Error("second message missing");
    assert.equal(next.held, false);
  });

  it("reopens a situation after the commander rejects the course", async () => {
    const odin = await createOdin();
    const drafted = await odin.draft("analyst");
    assert.equal(drafted.ok, true);
    const course = drafted.picture.courses.find((item) => !isRedacted(item) && item.title.includes("east relay"));
    if (!course || isRedacted(course)) throw new Error("course missing");
    const rejected = await odin.decide("commander", course.id, "reject", "Use the north relay instead.");
    assert.equal(rejected.ok, true);
    if (!rejected.ok) return;
    const kept = rejected.picture.courses.find((item) => item.id === course.id);
    if (!kept || isRedacted(kept)) throw new Error("rejected course missing");
    assert.equal(kept.status, "rejected");
    assert.match(kept.refusal ?? "", /north relay/);
    const open = rejected.picture.alerts.find((item) => item.id === "alt-mesh");
    if (!open || isRedacted(open)) throw new Error("alert missing");
    assert.equal(open.needsDecision, true);
    const again = await odin.draft("analyst");
    assert.equal(again.ok, true);
    if (!again.ok) return;
    const fresh = again.picture.courses.filter(
      (item) => !isRedacted(item) && item.status === "draft" && item.title.includes("east relay"),
    );
    assert.equal(fresh.length, 1);
    const next = fresh[0];
    if (!next || isRedacted(next)) throw new Error("second draft missing");
    assert.notEqual(next.id, course.id);
    assert.equal((await odin.verify()).ok, true);
  });

  it("projects the picture into the three public shapes", async () => {
    const odin = await createOdin();
    const feeds = projectFeeds(await odin.picture("observer"));
    assert.equal(feeds.sources.length, 3);
    const depot = feeds.entities.find((item) => ("entityId" in item ? item.entityId : item.id) === "trk-depot");
    assert.ok(depot && isRedacted(depot));
    const launch = feeds.launches[0];
    assert.equal(launch?.rocket, "POLLEN™");
    assert.match(launch?.details ?? "", /not a SpaceX/i);
    assert.equal(launch?.success, null);
  });

  it("composes a rehearsal score and does not let Conductor approve", async () => {
    const odin = await createOdin();
    const drafted = await odin.draft("analyst");
    assert.equal(drafted.ok, true);
    if (!drafted.ok) return;
    const course = drafted.picture.courses.find((item) => !isRedacted(item) && item.status === "draft");
    if (!course || isRedacted(course)) throw new Error("course missing");
    const approved = await odin.decide("commander", course.id, "approve");
    assert.equal(approved.ok, true);
    if (!approved.ok) return;
    const tasked = approved.picture.courses.find((item) => item.id === course.id);
    if (!tasked || isRedacted(tasked)) throw new Error("tasked course missing");
    assert.equal(tasked.score?.autonomy, "rehearsal");
    assert.equal(tasked.score?.permissions[0], "ecosystem");
    const names = CNDCTR_ACTIONS.map((item) => item.name);
    assert.equal(names.includes("decide"), false);
    const missing = await handleCndctrRequest(new Request("http://local/cndctr/v1/actions/decide", { method: "POST", body: "{}" }), "decide");
    assert.equal(missing.status, 404);
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

  it("does not tell an observer how many secret messages the relay is holding", async () => {
    const odin = await createOdin({ now: () => new Date("2026-11-05T00:00:00Z") });
    const sent = await odin.sendTraffic("commander", "Harbor Civil", "QUORUM-77 stays off the open net");
    assert.equal(sent.ok, true);
    const observer = await odin.ask("observer", "Is any FABRIC traffic held on the mesh?");
    assert.match(observer.answer, /degraded/i);
    assert.doesNotMatch(observer.answer, /1 FABRIC|QUORUM-77/);
    const commander = await odin.ask("commander", "Is the QUORUM-77 FABRIC traffic held on the mesh?");
    assert.match(commander.answer, /1 FABRIC/);
    const picture = await odin.picture("observer");
    assert.ok(picture.ledger.every((entry) => !String(entry.summary ?? "").includes("QUORUM-77")));
  });
});
