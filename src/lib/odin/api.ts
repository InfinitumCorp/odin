import { createServerFn } from "@tanstack/react-start";
import { askSchema, decideSchema, draftSchema, roleSchema, taskSchema, trafficSchema } from "./schemas.ts";

export const getPicture = createServerFn({ method: "POST" })
  .validator((input: unknown) => roleSchema.parse(input))
  .handler(async ({ data }) => {
    const { getOdin } = await import("./store.server.ts");
    return (await getOdin()).picture(data);
  });

export const askScene = createServerFn({ method: "POST" })
  .validator((input: unknown) => askSchema.parse(input))
  .handler(async ({ data }) => {
    const { getOdin } = await import("./store.server.ts");
    return (await getOdin()).ask(data.role, data.question);
  });

export const draftCourses = createServerFn({ method: "POST" })
  .validator((input: unknown) => draftSchema.parse(input))
  .handler(async ({ data }) => {
    const { getOdin } = await import("./store.server.ts");
    return (await getOdin()).draft(data.role);
  });

export const decideCourse = createServerFn({ method: "POST" })
  .validator((input: unknown) => decideSchema.parse(input))
  .handler(async ({ data }) => {
    const { getOdin } = await import("./store.server.ts");
    return (await getOdin()).decide(data.role, data.courseId, data.decision, data.note);
  });

export const advanceTask = createServerFn({ method: "POST" })
  .validator((input: unknown) => taskSchema.parse(input))
  .handler(async ({ data }) => {
    const { getOdin } = await import("./store.server.ts");
    return (await getOdin()).advanceTask(data.role, data.taskId, data.status);
  });

export const sendTraffic = createServerFn({ method: "POST" })
  .validator((input: unknown) => trafficSchema.parse(input))
  .handler(async ({ data }) => {
    const { getOdin } = await import("./store.server.ts");
    return (await getOdin()).sendTraffic(data.role, data.to, data.body);
  });
