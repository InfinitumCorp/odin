export const ROLES = ["observer", "analyst", "commander"] as const;
export type Role = (typeof ROLES)[number];

export type ClassLevel = 1 | 2 | 3;
export type ClassName = "CUI" | "SECRET" | "TS";

export const CLASS_NAME: Record<ClassLevel, ClassName> = {
  1: "CUI",
  2: "SECRET",
  3: "TS",
};

export const ROLE_CLEARANCE: Record<Role, ClassLevel> = {
  observer: 1,
  analyst: 2,
  commander: 3,
};

export const ROLE_ACTOR: Record<Role, string> = {
  observer: "CID-EX-OBSERVER",
  analyst: "CID-EX-ANALYST",
  commander: "CID-EX-COMMANDER",
};

export interface Redacted {
  redacted: true;
  id: string;
  classification: ClassName;
}

export interface TrackView {
  id: string;
  name: string;
  source: string;
  note: string;
  grid: string;
  confidence: string;
  classification: ClassName;
}

export interface AlertView {
  id: string;
  title: string;
  detail: string;
  needsDecision: boolean;
  classification: ClassName;
}

export interface SystemView {
  id: string;
  name: string;
  layer: string;
  state: "nominal" | "degraded";
  line: string;
  classification: ClassName;
}

export interface PartnerView {
  id: string;
  name: string;
  kind: string;
  status: string;
  note: string;
  classification: ClassName;
}

export interface CourseView {
  id: string;
  title: string;
  summary: string;
  steps: string[];
  status: "draft" | "approved" | "rejected" | "tasked";
  classification: ClassName;
}

export interface TaskView {
  id: string;
  courseId: string;
  assignee: string;
  order: string;
  status: "queued" | "in-progress" | "done";
  classification: ClassName;
}

export interface ObservationView {
  id: string;
  author: string;
  note: string;
  at: string;
  classification: ClassName;
}

export interface TrafficView {
  id: string;
  channel: string;
  from: string;
  to: string;
  body: string;
  at: string;
  classification: ClassName;
}

export interface LedgerView {
  seq: number;
  at: string;
  type: string;
  summary: string | null;
  hash: string;
  withheld: boolean;
}

export interface Picture {
  exercise: "NORTHLANTERN";
  generatedAt: string;
  role: Role;
  clearance: ClassName;
  posture: string;
  withheld: number;
  alerts: Array<AlertView | Redacted>;
  tracks: Array<TrackView | Redacted>;
  observations: Array<ObservationView | Redacted>;
  systems: SystemView[];
  partners: Array<PartnerView | Redacted>;
  courses: Array<CourseView | Redacted>;
  tasks: Array<TaskView | Redacted>;
  traffic: Array<TrafficView | Redacted>;
  ledger: LedgerView[];
  ledgerHead: string;
  ledgerLength: number;
  ledgerOk: boolean;
}

export interface CommandFailure {
  ok: false;
  error: string;
}

export function isRedacted(value: unknown): value is Redacted {
  return typeof value === "object" && value !== null && "redacted" in value && (value as Redacted).redacted === true;
}
