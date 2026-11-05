import { isRedacted, type Picture, type Redacted } from "./types.ts";

/**
 * Read-only projections of the exercise into three public contracts.
 * The code is ours. The field names follow the published shapes.
 * Nothing here calls Palantir, Anduril, or SpaceX.
 */

export const FEED_SOURCES = [
  {
    id: "ontology",
    name: "Ontology objects",
    repo: "palantir/osdk-ts",
    shape: "Object, primary key, properties, and a link.",
  },
  {
    id: "entity",
    name: "Lattice entities",
    repo: "anduril/lattice-sdk-python",
    shape: "Entity id, alias, grid, provenance, and an exercise template.",
  },
  {
    id: "launch",
    name: "Launch records",
    repo: "r-spacex/SpaceX-API",
    shape: "Launch name, date, rocket, pad, and whether it is still upcoming.",
  },
] as const;

export interface OntologyObject {
  apiName: "ExerciseTrack";
  primaryKey: string;
  title: string;
  properties: { grid: string; source: string; note: string };
}

export interface OntologyLink {
  apiName: "reportedBy";
  from: string;
  to: string;
}

export interface LatticeEntity {
  entityId: string;
  description: string;
  isLive: true;
  aliases: Array<{ name: string }>;
  location: { grid: string };
  provenance: { source: string; dataType: "exercise-track" };
  ontology: { platformType: "EXERCISE"; specificType: string; template: "TRACK" };
}

export interface LaunchRecord {
  id: string;
  name: string;
  date_utc: string;
  upcoming: boolean;
  success: null;
  flight_number: number;
  rocket: string;
  launchpad: string;
  details: string;
}

export interface Feeds {
  sources: typeof FEED_SOURCES;
  objects: Array<OntologyObject | Redacted>;
  links: OntologyLink[];
  entities: Array<LatticeEntity | Redacted>;
  launches: LaunchRecord[];
  note: string;
}

export function projectFeeds(picture: Picture): Feeds {
  const objects: Array<OntologyObject | Redacted> = [];
  const links: OntologyLink[] = [];
  const entities: Array<LatticeEntity | Redacted> = [];

  for (const track of picture.tracks) {
    if (isRedacted(track)) {
      const hidden: Redacted = { redacted: true, id: track.id, classification: track.classification };
      objects.push(hidden);
      entities.push(hidden);
      continue;
    }
    objects.push({
      apiName: "ExerciseTrack",
      primaryKey: track.id,
      title: track.name,
      properties: { grid: track.grid, source: track.source, note: track.note },
    });
    links.push({ apiName: "reportedBy", from: track.id, to: track.source });
    entities.push({
      entityId: track.id,
      description: track.note,
      isLive: true,
      aliases: [{ name: track.name }],
      location: { grid: track.grid },
      provenance: { source: track.source, dataType: "exercise-track" },
      ontology: { platformType: "EXERCISE", specificType: track.name, template: "TRACK" },
    });
  }

  const flower = picture.systems.find((system) => system.id === "flower");
  const resting = /offline|warm/i.test(flower?.line ?? "");
  const launches: LaunchRecord[] = [
    {
      id: "flower-hop",
      name: "Flower™ exercise hop",
      date_utc: picture.generatedAt,
      upcoming: !resting,
      success: null,
      flight_number: 1,
      rocket: "POLLEN™",
      launchpad: "Flower™",
      details: resting
        ? "Bay 3 is resting. This pad is fictional. It is not a SpaceX vehicle."
        : "Fictional pad on the exercise range. It is not a SpaceX vehicle.",
    },
  ];

  return {
    sources: FEED_SOURCES,
    objects,
    links,
    entities,
    launches,
    note: "Exercise data only. No live connection. No weapons release. The official SpaceX GitHub organization publishes no launch SDK, so the launch fields follow the public v4 record.",
  };
}
