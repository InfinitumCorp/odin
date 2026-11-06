import { Ledger, type RecordType } from "./firmament/ledger.ts";
import { MemoryStore } from "./firmament/store.ts";
import { generateSigner, type Signer } from "./firmament/keys.ts";
import { composeScore, type RehearsalScore } from "./score.ts";
import {
  CLASS_NAME,
  ROLE_ACTOR,
  ROLE_CLEARANCE,
  type AlertView,
  type ClassLevel,
  type CourseView,
  type LedgerView,
  type ObservationView,
  type PartnerView,
  type Picture,
  type Redacted,
  type Role,
  type SystemView,
  type TaskView,
  type TrackView,
  type TrafficView,
} from "./types.ts";

/**
 * ODIN° exercise backend.
 * Software model of the command cycle only: observe, orient, decide, act.
 * It does not model weapons release. Consequential tasking waits for a commander.
 * Records go to a private Firmament ledger, never the public nexus.
 */

const SIM_RATE = 4;

interface Track {
  id: string;
  name: string;
  source: string;
  note: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  confidence: number;
  classification: ClassLevel;
}

interface Alert {
  id: string;
  title: string;
  detail: string;
  needsDecision: boolean;
  classification: ClassLevel;
  courseId?: string;
}

interface SystemNode {
  id: string;
  name: string;
  layer: string;
  state: "nominal" | "degraded";
  line: string;
  classification: ClassLevel;
}

interface Partner {
  id: string;
  name: string;
  kind: string;
  status: string;
  note: string;
  classification: ClassLevel;
}

interface Course {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  status: "draft" | "approved" | "rejected" | "tasked" | "complete";
  classification: ClassLevel;
  alertId: string;
  refusal?: string;
  score?: RehearsalScore;
}

interface Task {
  id: string;
  courseId: string;
  assignee: string;
  order: string;
  status: "queued" | "in-progress" | "done";
  classification: ClassLevel;
}

interface Observation {
  id: string;
  author: string;
  note: string;
  at: string;
  classification: ClassLevel;
}

interface Traffic {
  id: string;
  channel: string;
  from: string;
  to: string;
  body: string;
  at: string;
  held: boolean;
  classification: ClassLevel;
}

interface Pending {
  type: RecordType;
  signer: Role | "system";
  actor: string;
  subject: string;
  summary: string;
  classification: ClassLevel;
}

interface World {
  tracks: Track[];
  observations: Observation[];
  alerts: Alert[];
  systems: SystemNode[];
  partners: Partner[];
  courses: Course[];
  tasks: Task[];
  traffic: Traffic[];
  flags: Set<string>;
  flowerThermal: number;
  elapsed: number;
  seq: number;
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

function grid(track: Track) {
  return `${Math.round(track.x)}, ${Math.round(track.y)}`;
}

function seedWorld(): World {
  return {
    tracks: [
      {
        id: "trk-truck",
        name: "Roster truck",
        source: "POLLEN™",
        note: "Friendly logistics truck. It is on the approved movement roster.",
        x: 22,
        y: 70,
        vx: 0.12,
        vy: 0,
        confidence: 0.91,
        classification: 1,
      },
      {
        id: "trk-pollen",
        name: "POLLEN™ Alpha",
        source: "Flower™",
        note: "Palm swarm covering the north of the range. It is drifting off the ridge.",
        x: 48,
        y: 40,
        vx: 0.04,
        vy: -0.35,
        confidence: 0.88,
        classification: 1,
      },
      {
        id: "trk-orbis",
        name: "ORBIS™ 4",
        source: "ORBIS™",
        note: "Inspection profile inside the tunnel. It is not armed, and it is not a weapon.",
        x: 74,
        y: 28,
        vx: 0,
        vy: 0,
        confidence: 0.84,
        classification: 1,
      },
      {
        id: "trk-nemesis",
        name: "NEMESIS™ 1",
        source: "NEMESIS™",
        note: "Close reconnaissance on the depot perimeter. Standoff only.",
        x: 58,
        y: 62,
        vx: 0,
        vy: 0.05,
        confidence: 0.8,
        classification: 1,
      },
      {
        id: "trk-depot",
        name: "Unrostered vehicle",
        source: ">_ARGUS™",
        note: "Ground vehicle on the depot road. It is not on the approved roster. Observe only.",
        x: 40,
        y: 58,
        vx: 0.7,
        vy: 0.02,
        confidence: 0.72,
        classification: 2,
      },
    ],
    observations: [],
    alerts: [
      {
        id: "alt-mesh",
        title: "East relay is losing packets",
        detail: "ÆTHER™ MIL is up, but the east relay is holding new FABRIC™ messages until it is restored.",
        needsDecision: true,
        classification: 1,
      },
      {
        id: "alt-liaison",
        title: "Harbor Civil is overdue",
        detail: "+SPCTR™ has no check-in from the liaison for 18 minutes. No mission data has been released.",
        needsDecision: true,
        classification: 2,
      },
    ],
    systems: [
      { id: "argus", name: ">_ARGUS™", layer: "Observe", state: "nominal", line: "Fusing drone, sensor and field feeds into one picture.", classification: 1 },
      { id: "pollen", name: "POLLEN™", layer: "Observe", state: "nominal", line: "Alpha is airborne. Bravo is on the pad at Flower™.", classification: 1 },
      { id: "flower", name: "Flower™", layer: "Observe", state: "nominal", line: "Launch and recovery are open. Six of eight bays are cool.", classification: 1 },
      { id: "orbis", name: "ORBIS™", layer: "Observe", state: "nominal", line: "Confined-space inspection. Video is up.", classification: 1 },
      { id: "nemesis", name: "NEMESIS™", layer: "Observe", state: "nominal", line: "Close reconnaissance, standoff, no approach task.", classification: 1 },
      { id: "hrvst", name: "[HRVST]™", layer: "Observe", state: "nominal", line: "LANTERN-3 field notes are in the picture. They are not for sale.", classification: 1 },
      { id: "spectre", name: "+SPCTR™", layer: "Orient", state: "degraded", line: "Liaison Harbor Civil is overdue. The roster check is waiting.", classification: 2 },
      { id: "eidetic", name: "ei·det·ic™", layer: "Orient", state: "nominal", line: "Callsigns resolve only against the exercise roster.", classification: 3 },
      { id: "metatron", name: "METATRON™", layer: "Orient", state: "nominal", line: "Common picture for this exercise. Closed configuration.", classification: 1 },
      { id: "scalvs", name: "SCALVS.ai™", layer: "Decide", state: "nominal", line: "Drafts courses of action. It cannot approve them.", classification: 1 },
      { id: "cndctr", name: "/CNDCTR/™", layer: "Decide", state: "nominal", line: "Turns an approved course into tasks. Commander approval first.", classification: 1 },
      { id: "aether", name: "ÆTHER™ MIL", layer: "Act", state: "degraded", line: "Mesh is up. East relay packet loss is elevated.", classification: 1 },
      { id: "fabric", name: "FABRIC™", layer: "Act", state: "nominal", line: "Secure voice and text across the mesh.", classification: 1 },
      { id: "eon", name: "E(O)N™", layer: "Act", state: "nominal", line: "Wearables on LANTERN teams are linked.", classification: 1 },
      { id: "cumulus", name: "Cumulus://Cloud™", layer: "Foundation", state: "nominal", line: "Exercise node is local. Nothing is synced to a public region.", classification: 1 },
      { id: "firmament", name: "Firmament Network™", layer: "Foundation", state: "nominal", line: "Private permissioned ledger for this exercise only.", classification: 1 },
    ],
    partners: [
      {
        id: "supply",
        name: "Range supply desk",
        kind: "Supplier",
        status: "Current",
        note: "Resupply is on the roster for the depot road.",
        classification: 1,
      },
      {
        id: "harbor",
        name: "Harbor Civil",
        kind: "Liaison",
        status: "Overdue",
        note: "Approved partner. Check-in is late. Share no mission data until they answer.",
        classification: 2,
      },
    ],
    courses: [],
    tasks: [],
    traffic: [
      {
        id: "msg-open",
        channel: "FABRIC™",
        from: "Exercise control",
        to: "All stations",
        body: "NORTHLANTERN is live. This is a simulation. Weapons release is not part of it.",
        at: "",
        held: false,
        classification: 1,
      },
    ],
    flags: new Set(),
    flowerThermal: 48,
    elapsed: 0,
    seq: 1,
  };
}

function courseFor(alert: Alert, id: string): Course | null {
  if (alert.id === "alt-mesh") {
    return {
      id,
      alertId: alert.id,
      title: "Restore the east relay",
      summary: "Shift traffic onto the west relays. Messages the east relay is holding go out when the mesh is whole.",
      steps: [
        "ÆTHER™ MIL shifts traffic onto the west relays.",
        "FABRIC™ releases the messages the east relay was holding.",
      ],
      status: "draft",
      classification: 1,
    };
  }
  if (alert.id === "alt-liaison") {
    return {
      id,
      alertId: alert.id,
      title: "Check in with Harbor Civil",
      summary: "Ask the liaison if they are still on the net. Do not attach mission data to the message.",
      steps: [
        "FABRIC™ sends a welfare check to Harbor Civil.",
        "+SPCTR™ keeps the relationship marked overdue until they answer.",
      ],
      status: "draft",
      classification: 2,
    };
  }
  if (alert.id === "alt-depot") {
    return {
      id,
      alertId: alert.id,
      title: "Hold the depot resupply",
      summary: "The unrostered vehicle is observed, not approached. The supply truck waits off the road.",
      steps: [
        "+SPCTR™ compares the vehicle with the approved movement roster.",
        "NEMESIS™ holds a standoff watch and does not close distance.",
        "The roster truck stays clear of the depot road until the commander says otherwise.",
      ],
      status: "draft",
      classification: 2,
    };
  }
  if (alert.id === "alt-gap") {
    return {
      id,
      alertId: alert.id,
      title: "Close the ridge gap",
      summary: "Move POLLEN™ Bravo onto the ridge. Leave the depot watch with NEMESIS™.",
      steps: [
        "Flower™ launches POLLEN™ Bravo toward the ridge.",
        "POLLEN™ Alpha continues, but Bravo owns the gap.",
        "NEMESIS™ stays on standoff at the depot.",
      ],
      status: "draft",
      classification: 2,
    };
  }
  if (alert.id === "alt-flower") {
    return {
      id,
      alertId: alert.id,
      title: "Rest Flower™ bay 3",
      summary: "Bay 3 is warm. Take it offline and launch only from bays that are cool.",
      steps: [
        "Flower™ marks bay 3 offline.",
        "Further POLLEN™ launches use the cool bays only.",
      ],
      status: "draft",
      classification: 2,
    };
  }
  return null;
}

export interface OdinSigners {
  system: Signer;
  observer: Signer;
  analyst: Signer;
  commander: Signer;
}

export class OdinService {
  private readonly world = seedWorld();
  private readonly pending: Pending[] = [];
  private lastReal: number;
  private readonly ledger: Ledger;
  private readonly signers: OdinSigners;
  private readonly now: () => Date;

  constructor(ledger: Ledger, signers: OdinSigners, now: () => Date) {
    this.ledger = ledger;
    this.signers = signers;
    this.now = now;
    this.lastReal = now().getTime();
    const opened = now().toISOString();
    const opening = this.world.traffic[0];
    if (opening) opening.at = opened;
  }

  async bootstrap() {
    this.queue({
      type: "audit",
      signer: "system",
      actor: "odin",
      subject: "exercise",
      summary: "Exercise NORTHLANTERN opened. Private ledger. No public token. No data sale.",
      classification: 1,
    });
    this.queue({
      type: "grant",
      signer: "commander",
      actor: ROLE_ACTOR.commander,
      subject: "clearance",
      summary: "Exercise clearances set. Observer CUI. Analyst SECRET. Commander TS. Human command holds.",
      classification: 1,
    });
    this.queue({
      type: "identity",
      signer: "system",
      actor: "ei·det·ic™",
      subject: "LANTERN-3",
      summary: "Callsign LANTERN-3 matches the exercise roster and nothing outside it.",
      classification: 3,
    });
    this.queue({
      type: "audit",
      signer: "system",
      actor: "FABRIC™",
      subject: "msg-open",
      summary: "Exercise control announced that weapons release is not part of NORTHLANTERN.",
      classification: 1,
    });
    await this.flush();
  }

  private queue(entry: Pending) {
    this.pending.push(entry);
  }

  private async flush() {
    const batch = this.pending.splice(0);
    for (const entry of batch) {
      await this.ledger.append(
        {
          type: entry.type,
          product: "odin",
          actor: entry.actor,
          subject: entry.subject,
          payload: {
            summary: entry.summary,
            classification: CLASS_NAME[entry.classification],
          },
        },
        this.signers[entry.signer],
      );
    }
  }

  private nextId(prefix: string) {
    this.world.seq += 1;
    return `${prefix}-${this.world.seq}`;
  }

  private meshDegraded() {
    return this.world.systems.find((item) => item.id === "aether")?.state === "degraded";
  }

  private step(dt: number) {
    const world = this.world;
    world.elapsed += dt;
    world.flowerThermal = Math.min(100, world.flowerThermal + 0.85 * dt);
    for (const track of world.tracks) {
      track.x = clamp(track.x + track.vx * dt, 4, 96);
      track.y = clamp(track.y + track.vy * dt, 4, 96);
    }

    const depot = world.tracks.find((track) => track.id === "trk-depot");
    if (depot && depot.x > 62 && !world.flags.has("depot")) {
      world.flags.add("depot");
      world.alerts.push({
        id: "alt-depot",
        title: "Unrostered vehicle at the depot road",
        detail: ">_ARGUS™ places a ground vehicle on the depot road. It is not on the +SPCTR™ roster. Observe only.",
        needsDecision: true,
        classification: 2,
      });
      this.queue({
        type: "provenance",
        signer: "system",
        actor: ">_ARGUS™",
        subject: "trk-depot",
        summary: "Sighting recorded: unrostered vehicle on the depot road. Observation only.",
        classification: 2,
      });
    }

    const pollen = world.tracks.find((track) => track.id === "trk-pollen");
    if (pollen && pollen.y < 30 && !world.flags.has("gap")) {
      world.flags.add("gap");
      world.alerts.push({
        id: "alt-gap",
        title: "Coverage is opening on the ridge",
        detail: "POLLEN™ Alpha has drifted north. The ridge between the pad and the tunnel is thinning.",
        needsDecision: true,
        classification: 2,
      });
      this.queue({
        type: "attestation",
        signer: "system",
        actor: "METATRON™",
        subject: "ridge",
        summary: "Forecast: ridge coverage falls if POLLEN™ Alpha is not backed up by Bravo.",
        classification: 2,
      });
    }

    if (world.flowerThermal > 72 && !world.flags.has("flower")) {
      world.flags.add("flower");
      const flower = world.systems.find((system) => system.id === "flower");
      if (flower) {
        flower.state = "degraded";
        flower.classification = 2;
        flower.line = "Bay 3 is warm. Launches should move to the cool bays.";
      }
      world.alerts.push({
        id: "alt-flower",
        title: "Flower™ bay 3 is warm",
        detail: "The bay should come offline before the next launch. The rest of the station is usable.",
        needsDecision: true,
        classification: 2,
      });
      this.queue({
        type: "attestation",
        signer: "system",
        actor: "Flower™",
        subject: "bay-3",
        summary: "Bay 3 crossed the exercise thermal limit.",
        classification: 2,
      });
    }
  }

  async catchUp() {
    const now = this.now().getTime();
    const simSeconds = Math.min(80, ((now - this.lastReal) / 1000) * SIM_RATE);
    if (simSeconds > 0.05) {
      this.step(simSeconds);
      this.lastReal = now;
      await this.flush();
    }
  }

  private gate<T extends { id: string; classification: ClassLevel }>(
    items: T[],
    role: Role,
    present: (item: T) => object,
  ): { rows: Array<object | Redacted>; withheld: number } {
    const ceiling = ROLE_CLEARANCE[role];
    let withheld = 0;
    const rows = items.map((item) => {
      if (item.classification <= ceiling) return present(item);
      withheld += 1;
      const redacted: Redacted = {
        redacted: true,
        id: item.id,
        classification: CLASS_NAME[item.classification],
      };
      return redacted;
    });
    return { rows, withheld };
  }

  async picture(role: Role, advance = true): Promise<Picture> {
    if (advance) await this.catchUp();
    const ceiling = ROLE_CLEARANCE[role];
    const tracks = this.gate(this.world.tracks, role, (track): TrackView => ({
      id: track.id,
      name: track.name,
      source: track.source,
      note: track.note,
      grid: grid(track),
      confidence: track.confidence.toFixed(2),
      classification: CLASS_NAME[track.classification],
    }));
    const observations = this.gate(this.world.observations, role, (item): ObservationView => ({
      id: item.id,
      author: item.author,
      note: item.note,
      at: item.at,
      classification: CLASS_NAME[item.classification],
    }));
    const alerts = this.gate(this.world.alerts, role, (alert): AlertView => ({
      id: alert.id,
      title: alert.title,
      detail: alert.detail,
      needsDecision: alert.needsDecision && !alert.courseId,
      classification: CLASS_NAME[alert.classification],
    }));
    const systems = {
      rows: this.world.systems.map((system): SystemView => ({
        id: system.id,
        name: system.name,
        layer: system.layer,
        state: system.state,
        line:
          system.classification <= ceiling
            ? system.line
            : "Detail withheld at this exercise clearance.",
        classification: CLASS_NAME[system.classification],
      })),
      withheld: this.world.systems.filter((system) => system.classification > ceiling).length,
    };
    const partners = this.gate(this.world.partners, role, (partner): PartnerView => ({
      id: partner.id,
      name: partner.name,
      kind: partner.kind,
      status: partner.status,
      note: partner.note,
      classification: CLASS_NAME[partner.classification],
    }));
    const courses = this.gate(this.world.courses, role, (course): CourseView => ({
      id: course.id,
      title: course.title,
      summary: course.summary,
      steps: course.steps,
      status: course.status,
      refusal: course.refusal ?? null,
      score: course.score ?? null,
      classification: CLASS_NAME[course.classification],
    }));
    const tasks = this.gate(this.world.tasks, role, (task): TaskView => ({
      id: task.id,
      courseId: task.courseId,
      assignee: task.assignee,
      order: task.order,
      status: task.status,
      classification: CLASS_NAME[task.classification],
    }));
    const traffic = this.gate(this.world.traffic, role, (message): TrafficView => ({
      id: message.id,
      channel: message.channel,
      from: message.from,
      to: message.to,
      body: message.body,
      at: message.at,
      held: message.held,
      classification: CLASS_NAME[message.classification],
    }));

    const entries = await this.ledger.entries();
    const verify = await this.ledger.verify();
    const ledger: LedgerView[] = entries.map((entry) => {
      const classification = String(entry.payload.classification ?? "CUI");
      const level = classification === "TS" ? 3 : classification === "SECRET" ? 2 : 1;
      const allowed = level <= ceiling;
      return {
        seq: entry.seq,
        at: entry.timestamp,
        type: entry.type,
        summary: allowed ? String(entry.payload.summary ?? "") : null,
        hash: entry.hash,
        withheld: !allowed,
      };
    });
    const withheld =
      tracks.withheld +
      observations.withheld +
      alerts.withheld +
      systems.withheld +
      partners.withheld +
      courses.withheld +
      tasks.withheld +
      traffic.withheld +
      ledger.filter((entry) => entry.withheld).length;

    const visibleDecisions = this.world.alerts.filter(
      (alert) => alert.needsDecision && !alert.courseId && alert.classification <= ceiling,
    ).length;

    return {
      exercise: "NORTHLANTERN",
      generatedAt: this.now().toISOString(),
      role,
      clearance: CLASS_NAME[ceiling],
      posture:
        visibleDecisions > 0
          ? `${visibleDecisions === 1 ? "One situation needs" : `${visibleDecisions} situations need`} a decision. SCALVS.ai™ can draft a course. Only a commander can approve it.`
          : "The picture is current. Nothing visible to this role is waiting on a commander.",
      withheld,
      alerts: alerts.rows as Picture["alerts"],
      tracks: tracks.rows as Picture["tracks"],
      observations: observations.rows as Picture["observations"],
      systems: systems.rows,
      partners: partners.rows as Picture["partners"],
      courses: courses.rows as Picture["courses"],
      tasks: tasks.rows as Picture["tasks"],
      traffic: traffic.rows as Picture["traffic"],
      ledger,
      ledgerHead: entries.at(-1)?.hash ?? "",
      ledgerLength: entries.length,
      ledgerOk: verify.ok,
    };
  }

  async ask(role: Role, question: string) {
    await this.catchUp();
    const q = question.toLowerCase();
    const ceiling = ROLE_CLEARANCE[role];
    const cites: string[] = [];
    const lines: string[] = [];

    const hidden = (level: ClassLevel, label: string) => {
      if (level <= ceiling) return false;
      lines.push(`${label} is on the picture, but it is above this role's exercise clearance.`);
      return true;
    };

    if (/(depot|vehicle|truck|roster)/.test(q)) {
      if (!hidden(2, "The depot-road vehicle")) {
        const track = this.world.tracks.find((item) => item.id === "trk-depot");
        lines.push(
          track
            ? `>_ARGUS™ has an unrostered vehicle at grid ${grid(track)}. The order, if approved, is to watch it and hold the resupply. Nobody is cleared to approach it.`
            : "No unrostered vehicle is on the picture.",
        );
        cites.push("trk-depot");
      }
    }
    if (/(ridge|gap|pollen|coverage)/.test(q)) {
      const track = this.world.tracks.find((item) => item.id === "trk-pollen");
      lines.push(
        track
          ? `POLLEN™ Alpha is at grid ${grid(track)}. ${track.y < 30 ? "The ridge coverage is thin." : "The ridge is still covered, and Alpha is drifting north."}`
          : "POLLEN™ is not on the picture.",
      );
      cites.push("trk-pollen");
    }
    if (/(flower|bay|thermal|launch)/.test(q)) {
      if (!hidden(this.world.flags.has("flower") ? 2 : 1, "The Flower™ fault")) {
        lines.push(
          this.world.flags.has("flower")
            ? "Flower™ bay 3 is warm. The draft course takes that bay offline and keeps the cool bays."
            : "Flower™ is inside limits. Six of eight bays are cool.",
        );
        cites.push("flower");
      }
    }
    if (/(harbor|liaison|partner|overdue)/.test(q)) {
      if (!hidden(2, "The Harbor Civil relationship")) {
        const harbor = this.world.partners.find((item) => item.id === "harbor");
        lines.push(
          harbor?.status === "Current"
            ? "Harbor Civil answered the welfare check. No mission data was sent."
            : "+SPCTR™ shows Harbor Civil overdue. A check-in goes by FABRIC™, with no mission data attached.",
        );
        cites.push("harbor");
      }
    }
    if (/(mesh|relay|fabric|message|traffic)/.test(q)) {
      const relay = this.world.systems.find((item) => item.id === "aether");
      if (!hidden(relay?.classification ?? 1, "The mesh")) {
        const held = this.world.traffic.filter((item) => item.held && item.classification <= ceiling).length;
        lines.push(
          relay?.state === "degraded"
            ? held === 0
              ? "The east relay is degraded. New FABRIC™ messages will be held."
              : `The east relay is degraded. ${held} FABRIC™ ${held === 1 ? "message is" : "messages are"} held until the relay is restored.`
            : "ÆTHER™ MIL is whole. FABRIC™ messages are going through.",
        );
        cites.push("aether");
      }
    }
    if (/(who|identity|callsign|lantern)/.test(q)) {
      if (!hidden(3, "The roster identity")) {
        lines.push("ei·det·ic™ resolves LANTERN-3 to the exercise roster only. No identity outside the roster is stored.");
        cites.push("LANTERN-3");
      }
    }
    if (/(ledger|custody|hash|firmament)/.test(q)) {
      const verify = await this.ledger.verify();
      lines.push(
        verify.ok
          ? `The private Firmament Network™ ledger is intact. ${verify.length} signed entries. Mission data is not on the public nexus.`
          : "The private ledger failed verification.",
      );
    }
    if (/(decide|approv|command|course|task)/.test(q)) {
      const open = this.world.alerts.filter((alert) => alert.needsDecision && !alert.courseId);
      const visible = open.filter((alert) => alert.classification <= ceiling);
      lines.push(
        visible.length
          ? `${visible.length === 1 ? "One visible situation needs" : `${visible.length} visible situations need`} a course. An analyst drafts. A commander approves. The system does not task itself.`
          : "Nothing visible to this role is waiting for approval.",
      );
    }

    if (!lines.length) {
      const picture = await this.picture(role, false);
      const first = picture.alerts.find((alert) => !("redacted" in alert && alert.redacted));
      lines.push(picture.posture);
      if (first && "title" in first) lines.push(first.detail);
    }

    this.queue({
      type: "audit",
      signer: role,
      actor: ROLE_ACTOR[role],
      subject: "ask",
      summary: `Asked the picture: ${question.slice(0, 180)}`,
      classification: ROLE_CLEARANCE[role],
    });
    await this.flush();

    return { ok: true as const, answer: lines.join(" "), cites };
  }

  async draft(role: Role) {
    await this.catchUp();
    if (ROLE_CLEARANCE[role] < 2) {
      return {
        ok: false as const,
        error: "An observer cannot draft a course. An analyst prepares it. A commander approves it.",
      };
    }
    let count = 0;
    for (const alert of this.world.alerts) {
      if (!alert.needsDecision || alert.courseId) continue;
      const course = courseFor(alert, this.nextId("course"));
      if (!course) continue;
      alert.courseId = course.id;
      this.world.courses.push(course);
      count += 1;
      this.queue({
        type: "audit",
        signer: role,
        actor: "SCALVS.ai™",
        subject: course.id,
        summary: `Drafted “${course.title}” for commander approval. Not tasked.`,
        classification: 2,
      });
    }
    await this.flush();
    return {
      ok: true as const,
      drafted: count,
      message: count ? "Courses are drafted. They are not tasked until a commander approves." : "Nothing new is waiting for a course.",
      picture: await this.picture(role, false),
    };
  }

  async decide(role: Role, courseId: string, decision: "approve" | "reject", note?: string) {
    await this.catchUp();
    if (role !== "commander") {
      return {
        ok: false as const,
        error: "Human command: only the commander can approve or reject a course. Nothing was tasked.",
      };
    }
    const course = this.world.courses.find((item) => item.id === courseId);
    if (!course) return { ok: false as const, error: "That course is not on the picture." };
    if (course.status !== "draft") {
      return { ok: false as const, error: "That course has already been decided." };
    }
    const remark = note?.trim();
    if (decision === "reject") {
      const reason = remark || "The commander rejected the course. No reason was written.";
      course.status = "rejected";
      course.refusal = reason;
      const alert = this.world.alerts.find((item) => item.id === course.alertId);
      if (alert && alert.courseId === course.id) {
        alert.courseId = undefined;
      }
      this.queue({
        type: "audit",
        signer: "commander",
        actor: ROLE_ACTOR.commander,
        subject: course.id,
        summary: `Rejected “${course.title}”. The situation is open again. ${reason}`,
        classification: course.classification,
      });
      await this.flush();
      return { ok: true as const, picture: await this.picture(role, false) };
    }
    course.status = "tasked";
    course.score = composeScore(course);
    for (const step of course.steps) {
      this.world.tasks.push({
        id: this.nextId("task"),
        courseId: course.id,
        assignee: step.split(" ")[0] ?? "Station",
        order: step,
        status: "queued",
        classification: course.classification,
      });
    }
    this.queue({
      type: "audit",
      signer: "commander",
      actor: ROLE_ACTOR.commander,
      subject: course.id,
      summary: `Approved “${course.title}”. /CNDCTR/™ composed a rehearsal score. It is not running.${remark ? ` ${remark}` : ""}`,
      classification: 2,
    });
    await this.flush();
    return { ok: true as const, picture: await this.picture(role, false) };
  }

  async advanceTask(role: Role, taskId: string, status: "in-progress" | "done") {
    await this.catchUp();
    if (ROLE_CLEARANCE[role] < 2) {
      return { ok: false as const, error: "An observer can read the picture. An analyst or the commander updates a task." };
    }
    const task = this.world.tasks.find((item) => item.id === taskId);
    if (!task) return { ok: false as const, error: "That task is not on the picture." };
    if (task.classification > ROLE_CLEARANCE[role]) {
      return { ok: false as const, error: "That task is above this role's exercise clearance." };
    }
    task.status = status;
    this.queue({
      type: "audit",
      signer: role,
      actor: ROLE_ACTOR[role],
      subject: task.id,
      summary: `Task marked ${status}. ${task.order}`,
      classification: task.classification,
    });
    const siblings = this.world.tasks.filter((item) => item.courseId === task.courseId);
    const course = this.world.courses.find((item) => item.id === task.courseId);
    if (course && course.status === "tasked" && siblings.length && siblings.every((item) => item.status === "done")) {
      this.settle(course);
    }
    await this.flush();
    return { ok: true as const, picture: await this.picture(role, false) };
  }

  private settle(course: Course) {
    course.status = "complete";
    const alert = this.world.alerts.find((item) => item.id === course.alertId);
    if (alert) alert.needsDecision = false;
    const at = this.now().toISOString();

    if (course.alertId === "alt-liaison") {
      const harbor = this.world.partners.find((item) => item.id === "harbor");
      if (harbor) {
        harbor.status = "Current";
        harbor.note = "Answered the welfare check. No mission data was sent.";
      }
      const spectre = this.world.systems.find((item) => item.id === "spectre");
      if (spectre) {
        spectre.state = "nominal";
        spectre.line = "Harbor Civil answered. The relationship is current.";
      }
      if (alert) {
        alert.title = "Harbor Civil answered";
        alert.detail = "The welfare check came back. The liaison is on the net, and no mission data was released.";
      }
      this.world.traffic.unshift({
        id: this.nextId("msg"),
        channel: "FABRIC™",
        from: "Harbor Civil",
        to: "Exercise control",
        body: "On the net. No assistance required. Send no mission data.",
        at,
        held: false,
        classification: 2,
      });
    }

    if (course.alertId === "alt-mesh") {
      const relay = this.world.systems.find((item) => item.id === "aether");
      if (relay) {
        relay.state = "nominal";
        relay.line = "Mesh is whole. Messages the east relay held have gone through.";
      }
      let released = 0;
      for (const message of this.world.traffic) {
        if (!message.held) continue;
        message.held = false;
        released += 1;
      }
      if (alert) {
        alert.title = "East relay is restored";
        alert.detail =
          released > 0
            ? `${released} held ${released === 1 ? "message has" : "messages have"} gone through. The mesh is whole.`
            : "Traffic is on the west relays. The mesh is whole.";
      }
    }

    if (course.alertId === "alt-depot") {
      const vehicle = this.world.tracks.find((item) => item.id === "trk-depot");
      if (vehicle) {
        vehicle.vx = 0;
        vehicle.note = "Held under observation. It was not approached, and it is not on the roster.";
      }
      const truck = this.world.tracks.find((item) => item.id === "trk-truck");
      if (truck) {
        truck.vx = 0;
        truck.note = "Held clear of the depot road until the commander says otherwise.";
      }
      if (alert) {
        alert.title = "Depot resupply is held";
        alert.detail = "The vehicle is watched from a standoff. The roster truck is clear of the road.";
      }
    }

    if (course.alertId === "alt-gap") {
      const pollen = this.world.tracks.find((item) => item.id === "trk-pollen");
      if (pollen) {
        pollen.vy = 0;
        pollen.note = "Bravo is covering the ridge. The gap is closed.";
      }
      if (alert) {
        alert.title = "Ridge coverage is restored";
        alert.detail = "POLLEN™ Bravo is on the ridge. NEMESIS™ remains on standoff.";
      }
    }

    if (course.alertId === "alt-flower") {
      const flower = this.world.systems.find((item) => item.id === "flower");
      if (flower) {
        flower.state = "nominal";
        flower.line = "Bay 3 is offline. Launches use the cool bays.";
      }
      if (alert) {
        alert.title = "Flower™ bay 3 is offline";
        alert.detail = "The warm bay is resting. The station can still launch.";
      }
    }

    this.queue({
      type: "attestation",
      signer: "system",
      actor: "/CNDCTR/™",
      subject: course.id,
      summary: `“${course.title}” is complete. The picture was updated.`,
      classification: course.classification,
    });
  }

  async sendTraffic(role: Role, to: string, body: string) {
    await this.catchUp();
    if (ROLE_CLEARANCE[role] < 2) {
      return { ok: false as const, error: "An observer cannot send on FABRIC™. An analyst or the commander can." };
    }
    const message: Traffic = {
      id: this.nextId("msg"),
      channel: "FABRIC™",
      from: ROLE_ACTOR[role],
      to,
      body,
      at: this.now().toISOString(),
      held: this.meshDegraded(),
      classification: 2,
    };
    this.world.traffic.unshift(message);
    this.queue({
      type: "audit",
      signer: role,
      actor: ROLE_ACTOR[role],
      subject: message.id,
      summary: message.held
        ? `FABRIC™ to ${to} is held by the east relay.`
        : `FABRIC™ to ${to}: ${body.slice(0, 180)}`,
      classification: 2,
    });
    await this.flush();
    return { ok: true as const, picture: await this.picture(role, false) };
  }

  async observe(role: Role, note: string) {
    await this.catchUp();
    const item: Observation = {
      id: this.nextId("obs"),
      author: ROLE_ACTOR[role],
      note,
      at: this.now().toISOString(),
      classification: ROLE_CLEARANCE[role],
    };
    this.world.observations.unshift(item);
    this.queue({
      type: "provenance",
      signer: role,
      actor: "[HRVST]™",
      subject: item.id,
      summary: `Field note from ${item.author}: ${note.slice(0, 180)}`,
      classification: item.classification,
    });
    await this.flush();
    return { ok: true as const, picture: await this.picture(role, false) };
  }

  async verify() {
    return this.ledger.verify();
  }
}

export async function createOdin(options?: { now?: () => Date }) {
  const now = options?.now ?? (() => new Date());
  const signers: OdinSigners = {
    system: generateSigner(),
    observer: generateSigner(),
    analyst: generateSigner(),
    commander: generateSigner(),
  };
  const ledger = new Ledger(new MemoryStore(), {
    authorizedSigners: Object.values(signers).map((signer) => signer.publicKey),
    clock: now,
  });
  const service = new OdinService(ledger, signers, now);
  await service.bootstrap();
  return service;
}
