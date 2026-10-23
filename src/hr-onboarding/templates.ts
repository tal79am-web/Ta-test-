import { TaskKey } from "./types";

// Versioned task plan (R2). Deterministic: no LLM involved.
// This v1 template has 7 tasks, not the ~40 in the spec. The full set depends on
// discovery item U3 (the six systems) and must be added as new versions.
export const TEMPLATE_VERSION = "2026.10.1";

export interface DueOffset {
  unit: "business_days" | "calendar_days";
  days: number;
}

export interface TaskTemplate {
  key: TaskKey;
  system: string;
  owner: string;
  offset: DueOffset;
  dependsOn: TaskKey[];
}

export const TASK_TEMPLATES: readonly TaskTemplate[] = [
  { key: "it_request", system: "servicenow", owner: "it-service-desk", offset: { unit: "business_days", days: -2 }, dependsOn: [] },
  { key: "welcome_email", system: "email", owner: "hr-ops", offset: { unit: "business_days", days: -1 }, dependsOn: [] },
  { key: "track_assign", system: "lms", owner: "hr-ops", offset: { unit: "business_days", days: -1 }, dependsOn: [] },
  { key: "buddy_proposal", system: "internal", owner: "hr-ops", offset: { unit: "business_days", days: -3 }, dependsOn: [] },
  { key: "checkpoint_30d", system: "calendar", owner: "manager", offset: { unit: "calendar_days", days: 30 }, dependsOn: [] },
  { key: "benefits_reminder", system: "email", owner: "hr-ops", offset: { unit: "calendar_days", days: 7 }, dependsOn: [] },
  {
    key: "handoff_pack",
    system: "internal",
    owner: "hr-ops",
    offset: { unit: "calendar_days", days: 13 },
    dependsOn: ["it_request", "welcome_email", "track_assign", "buddy_proposal", "checkpoint_30d", "benefits_reminder"],
  },
];
