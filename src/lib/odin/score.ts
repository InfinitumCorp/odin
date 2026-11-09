export interface RehearsalScore {
  id: string;
  goal: string;
  autonomy: "rehearsal";
  permissions: ["ecosystem"];
  successCriteria: string[];
}

/** A Score in the :\ARCHITECT\™ sense. Rehearsal only: drafted, not run. */
export function composeScore(course: { id: string; title: string }): RehearsalScore {
  return {
    id: `score-${course.id}`,
    goal: course.title,
    autonomy: "rehearsal",
    permissions: ["ecosystem"],
    successCriteria: [
      "The tasks on this course are done.",
      "The picture shows the change the course described.",
      "No message was sent and no course was approved by Architect.",
    ],
  };
}
