import { z } from "zod";

// R4: email intake. The model classifies and extracts only. Its output is validated
// against a fixed schema. Routing is decided in code, not by the model.

export const INTAKE_CONFIDENCE_FLOOR = 0.8;

export const INTAKE_INTENTS = [
  "worker_type_clarification",
  "start_date_change",
  "equipment_request",
  "i9_documents_submitted",
  "buddy_preference",
  "benefits_question",
  "hold_instruction",
  "other",
] as const;

/** Intents the agent records without a human. Everything else goes to the review queue. */
export const AUTO_ACCEPT_INTENTS: ReadonlySet<string> = new Set([
  "worker_type_clarification",
  "start_date_change",
  "equipment_request",
  "i9_documents_submitted",
  "buddy_preference",
]);

export const IntakeOutputSchema = z.object({
  case_id: z.string().nullable(),
  intents: z.array(z.enum(INTAKE_INTENTS)).min(1),
  fields: z.record(z.string()),
  confidence: z.number().min(0).max(1),
  evidence_quote: z.string(),
  suspected_prompt_injection: z.boolean(),
});

export type IntakeOutput = z.infer<typeof IntakeOutputSchema>;

export interface IntakeEmail {
  messageId: string;
  sender: string;
  threadId: string;
  body: string;
}

/** Wraps the hosted model call. Returns raw output, which is validated before use. */
export type IntakeClassifier = (email: IntakeEmail) => Promise<unknown>;

export type IntakeParse =
  | { ok: true; value: IntakeOutput; attempts: number }
  | { ok: false; error: string; attempts: number };

/** One attempt, then one retry on schema failure or classifier error. Then give up. */
export async function classifyIntake(email: IntakeEmail, classify: IntakeClassifier): Promise<IntakeParse> {
  const maxAttempts = 2;
  let lastError = "no attempt made";
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let raw: unknown;
    try {
      raw = await classify(email);
    } catch (error) {
      lastError = `classifier error: ${error instanceof Error ? error.message : String(error)}`;
      continue;
    }
    if (typeof raw === "string") {
      try {
        raw = JSON.parse(raw);
      } catch {
        lastError = "classifier returned text that is not JSON";
        continue;
      }
    }
    const parsed = IntakeOutputSchema.safeParse(raw);
    if (parsed.success) return { ok: true, value: parsed.data, attempts: attempt };
    lastError = parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; ");
  }
  return { ok: false, error: lastError, attempts: maxAttempts };
}
