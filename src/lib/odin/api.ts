import { createServerFn } from "@tanstack/react-start";
import { askSchema, decideSchema, draftSchema, observationSchema, roleSchema, taskSchema, trafficSchema } from "./schemas.ts";

export const getPicture = createServerFn({ method: "POST" })
  .validator((input: unknown) => roleSchema.parse(input))
  .handler(async ({ data }) => {
    const { getEon, getOdin } = await import("./store.server.ts");
    const { withEon } = await import("./eon.ts");
    return withEon(getEon(), await (await getOdin()).picture(data));
  });

export const askScene = createServerFn({ method: "POST" })
  .validator((input: unknown) => askSchema.parse(input))
  .handler(async ({ data }) => {
    const { getEon, getOdin } = await import("./store.server.ts");
    const { withEon } = await import("./eon.ts");
    return withEon(getEon(), await (await getOdin()).ask(data.role, data.question));
  });

export const draftCourses = createServerFn({ method: "POST" })
  .validator((input: unknown) => draftSchema.parse(input))
  .handler(async ({ data }) => {
    const { getEon, getOdin } = await import("./store.server.ts");
    const { withEon } = await import("./eon.ts");
    return withEon(getEon(), await (await getOdin()).draft(data.role));
  });

export const decideCourse = createServerFn({ method: "POST" })
  .validator((input: unknown) => decideSchema.parse(input))
  .handler(async ({ data }) => {
    const { getEon, getOdin } = await import("./store.server.ts");
    const { withEon } = await import("./eon.ts");
    return withEon(getEon(), await (await getOdin()).decide(data.role, data.courseId, data.decision, data.note));
  });

export const advanceTask = createServerFn({ method: "POST" })
  .validator((input: unknown) => taskSchema.parse(input))
  .handler(async ({ data }) => {
    const { getEon, getOdin } = await import("./store.server.ts");
    const { withEon } = await import("./eon.ts");
    return withEon(getEon(), await (await getOdin()).advanceTask(data.role, data.taskId, data.status));
  });

export const fileObservation = createServerFn({ method: "POST" })
  .validator((input: unknown) => observationSchema.parse(input))
  .handler(async ({ data }) => {
    const { getEon, getOdin } = await import("./store.server.ts");
    const { withEon } = await import("./eon.ts");
    return withEon(getEon(), await (await getOdin()).observe(data.role, data.note));
  });

export const sendTraffic = createServerFn({ method: "POST" })
  .validator((input: unknown) => trafficSchema.parse(input))
  .handler(async ({ data }) => {
    const { getEon, getOdin } = await import("./store.server.ts");
    const { withEon } = await import("./eon.ts");
    return withEon(getEon(), await (await getOdin()).sendTraffic(data.role, data.to, data.body));
  });
