import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import {
  advanceTask,
  askScene,
  decideCourse,
  draftCourses,
  fileObservation,
  getPicture,
  sendTraffic,
} from "@/lib/odin/api";
import { isRedacted, type Picture, type Role } from "@/lib/odin/types";
import { projectFeeds } from "@/lib/odin/feeds";
import { Rich } from "@/components/rich";

const ROLES: { id: Role; label: string }[] = [
  { id: "observer", label: "Observer" },
  { id: "analyst", label: "Analyst" },
  { id: "commander", label: "Commander" },
];

const VIEWS = ["Picture", "Decide", "Record", "Feeds"] as const;
type View = (typeof VIEWS)[number];

const LAYERS = ["Observe", "Orient", "Decide", "Act", "Foundation"];

export function OdinConsole() {
  const loadPicture = useServerFn(getPicture);
  const ask = useServerFn(askScene);
  const draft = useServerFn(draftCourses);
  const decide = useServerFn(decideCourse);
  const moveTask = useServerFn(advanceTask);
  const send = useServerFn(sendTraffic);
  const fileNote = useServerFn(fileObservation);

  const [role, setRole] = useState<Role>("observer");
  const [view, setView] = useState<View>("Picture");
  const [picture, setPicture] = useState<Picture | null>(null);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [note, setNote] = useState("");
  const [to, setTo] = useState("Harbor Civil");
  const [body, setBody] = useState("");
  const [fieldNote, setFieldNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let stop = false;
    const pull = () => {
      loadPicture({ data: role })
        .then((next) => {
          if (!stop) setPicture(next);
        })
        .catch(() => {
          if (!stop) setError("The picture did not load. Try again in a moment.");
        });
    };
    pull();
    const timer = window.setInterval(pull, 4000);
    return () => {
      stop = true;
      window.clearInterval(timer);
    };
  }, [loadPicture, role]);

  async function run(work: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await work();
    } catch {
      setError("That request did not complete.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-16">
      <p className="label">
        <Rich text="Infinitum Corporation®" />
      </p>
      <h1 className="wordmark h1 mt-6">
        ODIN°<sup className="tm">™</sup>
      </h1>
      <p className="lead mt-6 text-ink">
        One command picture for the exercise. AI-powered. Blockchain-governed™. Human-commanded.
      </p>
      <p className="body mt-4 text-muted">
        Exercise NORTHLANTERN is simulated. It is not for operational use. Mission data stays on a private
        ledger and is not for sale.
      </p>

      <div className="mt-10 flex flex-wrap gap-2">
        {ROLES.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`h-11 rounded-full px-4 ${role === item.id ? "bg-ink text-paper" : "text-muted"}`}
            onClick={() => {
              setRole(item.id);
              setAnswer("");
              setError("");
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      {picture ? (
        <p className="label mt-4">
          Exercise clearance {picture.clearance}
          {picture.withheld > 0 ? ` · ${picture.withheld} records withheld` : ""}
        </p>
      ) : (
        <p className="label mt-4">Opening the exercise picture…</p>
      )}

      <section className="mt-12 border-t border-line pt-10">
        <h2 className="h3">Ask the picture</h2>
        <form
          className="mt-6 flex flex-col gap-3 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const value = question.trim();
            if (!value) return;
            void run(async () => {
              const result = await ask({ data: { role, question: value } });
              setAnswer(result.answer);
            });
          }}
        >
          <input
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="What needs a commander?"
            className="body h-12 min-w-0 flex-1 rounded-xl border border-line bg-paper px-4 text-ink"
            maxLength={400}
          />
          <button type="submit" disabled={busy || !question.trim()} className="h-12 rounded-xl bg-ink px-6 text-paper disabled:opacity-40">
            Ask
          </button>
        </form>
        {answer ? (
          <p className="body mt-6">
            <Rich text={answer} />
          </p>
        ) : null}
        {error ? <p className="body mt-6 text-muted">{error}</p> : null}
      </section>

      <nav className="mt-12 flex flex-wrap gap-2 border-t border-line pt-8">
        {VIEWS.map((item) => (
          <button
            key={item}
            type="button"
            className={`h-11 rounded-full px-4 ${view === item ? "bg-ink text-paper" : "text-muted"}`}
            onClick={() => setView(item)}
          >
            {item}
          </button>
        ))}
      </nav>

      {picture && view === "Picture" ? (
        <PictureView
          picture={picture}
          fieldNote={fieldNote}
          busy={busy}
          onFieldNote={setFieldNote}
          onFile={() =>
            void run(async () => {
              const result = await fileNote({ data: { role, note: fieldNote.trim() } });
              setPicture(result.picture);
              setFieldNote("");
            })
          }
        />
      ) : null}
      {picture && view === "Decide" ? (
        <DecideView
          picture={picture}
          role={role}
          note={note}
          busy={busy}
          onNote={setNote}
          onDraft={() =>
            void run(async () => {
              const result = await draft({ data: { role } });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setPicture(result.picture);
            })
          }
          onDecide={(courseId, decision) =>
            void run(async () => {
              const result = await decide({
                data: { role, courseId, decision, note: note.trim() || undefined },
              });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setPicture(result.picture);
              setNote("");
            })
          }
          onTask={(taskId, status) =>
            void run(async () => {
              const result = await moveTask({ data: { role, taskId, status } });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setPicture(result.picture);
            })
          }
        />
      ) : null}
      {picture && view === "Record" ? (
        <RecordView
          picture={picture}
          to={to}
          body={body}
          busy={busy}
          onTo={setTo}
          onBody={setBody}
          onSend={() =>
            void run(async () => {
              const result = await send({ data: { role, to: to.trim(), body: body.trim() } });
              if (!result.ok) {
                setError(result.error);
                return;
              }
              setPicture(result.picture);
              setBody("");
            })
          }
        />
      ) : null}
      {picture && view === "Feeds" ? <FeedsView picture={picture} /> : null}
    </main>
  );
}

function PictureView({
  picture,
  fieldNote,
  busy,
  onFieldNote,
  onFile,
}: {
  picture: Picture;
  fieldNote: string;
  busy: boolean;
  onFieldNote: (value: string) => void;
  onFile: () => void;
}) {
  return (
    <div className="mt-10">
      <p className="body">
        <Rich text={picture.posture} />
      </p>
      <form
        className="mt-10 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!fieldNote.trim()) return;
          onFile();
        }}
      >
        <h2 className="h3">Field note</h2>
        <p className="body text-muted">
          <Rich text="[HRVST]™ files the note at this role's clearance. A lower role cannot read it. It is not for sale." />
        </p>
        <input
          value={fieldNote}
          onChange={(event) => onFieldNote(event.target.value)}
          placeholder="What you saw"
          maxLength={500}
          className="body h-12 rounded-xl border border-line bg-paper px-4"
        />
        <button
          type="submit"
          disabled={busy || !fieldNote.trim()}
          className="h-12 self-start rounded-xl border border-line px-6 disabled:opacity-40"
        >
          File
        </button>
      </form>
      {picture.observations.length ? (
        <ul className="mt-8 flex flex-col gap-8">
          {picture.observations.map((item) => (
            <li key={item.id}>
              {isRedacted(item) ? (
                <Withheld classification={item.classification} />
              ) : (
                <>
                  <p className="label">{item.author}</p>
                  <p className="body mt-2">{item.note}</p>
                </>
              )}
            </li>
          ))}
        </ul>
      ) : null}
      <h2 className="h3 mt-12">Situations</h2>
      <ul className="mt-6 flex flex-col gap-8">
        {picture.alerts.map((alert) => (
          <li key={alert.id}>
            {isRedacted(alert) ? (
              <Withheld classification={alert.classification} />
            ) : (
              <>
                <p className="body">{alert.title}</p>
                <p className="body mt-2 text-muted">
                  <Rich text={alert.detail} />
                </p>
              </>
            )}
          </li>
        ))}
      </ul>

      <h2 className="h3 mt-12">Movement</h2>
      <ul className="mt-6 flex flex-col gap-8">
        {picture.tracks.map((track) => (
          <li key={track.id}>
            {isRedacted(track) ? (
              <Withheld classification={track.classification} />
            ) : (
              <>
                <p className="body">
                  <Rich text={track.name} />
                  <span className="text-muted"> · grid {track.grid}</span>
                </p>
                <p className="body mt-2 text-muted">
                  <Rich text={`${track.source}. ${track.note}`} />
                </p>
              </>
            )}
          </li>
        ))}
      </ul>

      <h2 className="h3 mt-12">Relationships</h2>
      <ul className="mt-6 flex flex-col gap-8">
        {picture.partners.map((partner) => (
          <li key={partner.id}>
            {isRedacted(partner) ? (
              <Withheld classification={partner.classification} />
            ) : (
              <>
                <p className="body">
                  {partner.name}
                  <span className="text-muted"> · {partner.status}</span>
                </p>
                <p className="body mt-2 text-muted">{partner.note}</p>
              </>
            )}
          </li>
        ))}
      </ul>

      {LAYERS.map((layer) => {
        const systems = picture.systems.filter((system) => system.layer === layer);
        if (!systems.length) return null;
        return (
          <section key={layer}>
            <h2 className="h3 mt-12">{layer}</h2>
            <ul className="mt-6 flex flex-col gap-8">
              {systems.map((system) => (
                <li key={system.id}>
                  <p className="wordmark">
                    <Rich text={system.name} />
                    <span className="font-normal text-muted"> · {system.state}</span>
                  </p>
                  <p className="body mt-2 text-muted">
                    <Rich text={system.line} />
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function DecideView({
  picture,
  role,
  note,
  busy,
  onNote,
  onDraft,
  onDecide,
  onTask,
}: {
  picture: Picture;
  role: Role;
  note: string;
  busy: boolean;
  onNote: (value: string) => void;
  onDraft: () => void;
  onDecide: (courseId: string, decision: "approve" | "reject") => void;
  onTask: (taskId: string, status: "in-progress" | "done") => void;
}) {
  const hasDraft = picture.courses.some((course) => !isRedacted(course) && course.status === "draft");
  return (
    <div className="mt-10">
      <p className="body text-muted">
        SCALVS.ai™ drafts. :\ARCHITCT\™ tasks only after the commander approves. Nothing here is a use of force.
      </p>
      <button
        type="button"
        disabled={busy || role === "observer"}
        onClick={onDraft}
        className={`mt-6 h-12 rounded-xl px-6 disabled:opacity-40 ${hasDraft ? "border border-line bg-paper text-ink" : "bg-ink text-paper"}`}
      >
        Draft courses
      </button>
      {!picture.courses.length ? <p className="body mt-8 text-muted">No course is visible to this role yet.</p> : null}
      <ul className="mt-10 flex flex-col gap-12">
        {picture.courses.map((course) =>
          isRedacted(course) ? (
            <li key={course.id}>
              <Withheld classification={course.classification} />
            </li>
          ) : (
            <li key={course.id} className="border-t border-line pt-8">
              <p className="label">{course.status}</p>
              <h2 className="h3 mt-3">{course.title}</h2>
              <p className="body mt-4">{course.summary}</p>
              {course.refusal ? <p className="body mt-4 text-muted">{course.refusal}</p> : null}
              {course.score ? (
                <p className="body mt-4 text-muted">
                  :\ARCHITCT\™ composed a rehearsal score. It is not running.
                </p>
              ) : null}
              <ul className="mt-4 flex flex-col gap-2">
                {course.steps.map((step) => (
                  <li key={step} className="body text-muted">
                    <Rich text={step} />
                  </li>
                ))}
              </ul>
              {course.status === "draft" ? (
                <div className="mt-6 flex flex-col gap-3">
                  <input
                    value={note}
                    onChange={(event) => onNote(event.target.value)}
                    placeholder="Note for the record"
                    maxLength={400}
                    className="body h-12 rounded-xl border border-line bg-paper px-4"
                  />
                  <div className="flex flex-wrap gap-3">
                    <button
                      type="button"
                      disabled={busy || role !== "commander"}
                      onClick={() => onDecide(course.id, "approve")}
                      className="h-12 rounded-xl bg-ink px-6 text-paper disabled:opacity-40"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      disabled={busy || role !== "commander"}
                      onClick={() => onDecide(course.id, "reject")}
                      className="h-12 rounded-xl border border-line bg-paper px-6 disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </div>
                  {role !== "commander" ? (
                    <p className="label">Only the commander can approve or reject.</p>
                  ) : null}
                </div>
              ) : null}
            </li>
          ),
        )}
      </ul>
      {picture.tasks.length ? (
        <>
          <h2 className="h3 mt-12">Tasks</h2>
          <ul className="mt-6 flex flex-col gap-8">
            {picture.tasks.map((task) =>
              isRedacted(task) ? (
                <li key={task.id}>
                  <Withheld classification={task.classification} />
                </li>
              ) : (
                <li key={task.id}>
                  <p className="body">
                    <Rich text={task.order} />
                  </p>
                  <p className="label mt-2">{task.status}</p>
                  {task.status !== "done" ? (
                    <div className="mt-3 flex flex-wrap gap-3">
                      {task.status === "queued" ? (
                        <button
                          type="button"
                          disabled={busy || role === "observer"}
                          onClick={() => onTask(task.id, "in-progress")}
                          className="h-11 rounded-xl border border-line px-4 disabled:opacity-40"
                        >
                          Start
                        </button>
                      ) : null}
                      <button
                        type="button"
                        disabled={busy || role === "observer"}
                        onClick={() => onTask(task.id, "done")}
                        className="h-11 rounded-xl border border-line px-4 disabled:opacity-40"
                      >
                        Done
                      </button>
                    </div>
                  ) : null}
                </li>
              ),
            )}
          </ul>
        </>
      ) : null}
    </div>
  );
}

function RecordView({
  picture,
  to,
  body,
  busy,
  onTo,
  onBody,
  onSend,
}: {
  picture: Picture;
  to: string;
  body: string;
  busy: boolean;
  onTo: (value: string) => void;
  onBody: (value: string) => void;
  onSend: () => void;
}) {
  return (
    <div className="mt-10">
      <p className="body">
        {picture.ledgerOk
          ? "The private ledger is intact. Every entry is signed, and a change would break the chain."
          : "The private ledger failed verification."}
      </p>
      <p className="label mt-3">{picture.ledgerLength} entries</p>

      <form
        className="mt-10 flex flex-col gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (!to.trim() || !body.trim()) return;
          onSend();
        }}
      >
        <h2 className="h3">Send on FABRIC™</h2>
        <input
          value={to}
          onChange={(event) => onTo(event.target.value)}
          className="body h-12 rounded-xl border border-line px-4"
          maxLength={80}
        />
        <input
          value={body}
          onChange={(event) => onBody(event.target.value)}
          placeholder="A message, not an order"
          className="body h-12 rounded-xl border border-line px-4"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={busy || !body.trim()}
          className="h-12 self-start rounded-xl border border-line px-6 disabled:opacity-40"
        >
          Send
        </button>
      </form>

      <h2 className="h3 mt-12">Recent messages</h2>
      <ul className="mt-6 flex flex-col gap-8">
        {picture.traffic.map((message) => (
          <li key={message.id}>
            {isRedacted(message) ? (
              <Withheld classification={message.classification} />
            ) : (
              <>
                <p className="label">
                  <Rich text={`${message.channel} · ${message.from} to ${message.to}`} />
                  {message.held ? " · held" : ""}
                </p>
                <p className="body mt-2">{message.body}</p>
              </>
            )}
          </li>
        ))}
      </ul>

      <h2 className="h3 mt-12">Chain of custody</h2>
      <ol className="mt-6 flex flex-col gap-8">
        {[...picture.ledger].reverse().map((entry) => (
          <li key={entry.seq}>
            <p className="label">
              {entry.seq} · {entry.type}
              {entry.withheld ? " · withheld" : ""}
            </p>
            <p className="body mt-2">{entry.summary ?? "Above this role's exercise clearance."}</p>
            <p className="label mt-2 break-all">{entry.hash}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}

function FeedsView({ picture }: { picture: Picture }) {
  const feeds = projectFeeds(picture);
  return (
    <div className="mt-10">
      <p className="body">{feeds.note}</p>
      <ul className="mt-8 flex flex-col gap-6">
        {feeds.sources.map((source) => (
          <li key={source.id}>
            <p className="body">{source.name}</p>
            <p className="body mt-2 text-muted">
              {source.repo}. {source.shape}
            </p>
          </li>
        ))}
      </ul>

      <h2 className="h3 mt-12">Objects</h2>
      <ul className="mt-6 flex flex-col gap-8">
        {feeds.objects.map((object) => (
          <li key={isRedacted(object) ? object.id : object.primaryKey}>
            {isRedacted(object) ? (
              <Withheld classification={object.classification} />
            ) : (
              <>
                <p className="body">
                  <Rich text={object.title} />
                  <span className="text-muted"> · {object.properties.grid}</span>
                </p>
                <p className="body mt-2 text-muted">
                  <Rich text={`${object.properties.source}. ${object.properties.note}`} />
                </p>
              </>
            )}
          </li>
        ))}
      </ul>

      <h2 className="h3 mt-12">Entities</h2>
      <ul className="mt-6 flex flex-col gap-8">
        {feeds.entities.map((entity) => (
          <li key={isRedacted(entity) ? entity.id : entity.entityId}>
            {isRedacted(entity) ? (
              <Withheld classification={entity.classification} />
            ) : (
              <>
                <p className="body">
                  <Rich text={entity.aliases[0]?.name ?? entity.entityId} />
                  <span className="text-muted"> · grid {entity.location.grid}</span>
                </p>
                <p className="body mt-2 text-muted">
                  <Rich text={`${entity.provenance.source}. ${entity.description}`} />
                </p>
              </>
            )}
          </li>
        ))}
      </ul>

      <h2 className="h3 mt-12">Launches</h2>
      <ul className="mt-6 flex flex-col gap-8">
        {feeds.launches.map((launch) => (
          <li key={launch.id}>
            <p className="body">
              <Rich text={launch.name} />
              <span className="text-muted"> · {launch.upcoming ? "upcoming" : "held"}</span>
            </p>
            <p className="body mt-2 text-muted">
              <Rich text={`${launch.rocket} from ${launch.launchpad}. ${launch.details}`} />
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

function Withheld({ classification }: { classification: string }) {
  return <p className="body text-muted">Withheld. Above this role. {classification}.</p>;
}
