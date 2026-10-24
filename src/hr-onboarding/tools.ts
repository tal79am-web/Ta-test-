import { Store } from "./store";
import { WorkerType } from "./types";

// R5: the only side-effect surface. Every call goes through ToolRunner, which
// logs it and applies the idempotency key so a retry never repeats a write.

export interface ToolContract {
  workday_get_worker: {
    params: { workerId: string };
    result: { workerId: string; linkedRecords: { workerId: string; workerType: string }[] };
  };
  servicenow_create_request: {
    params: { workerId: string; roleFamily: string | null };
    result: { requestId: string };
  };
  servicenow_get_status: {
    params: { requestId: string };
    result: { status: "OPEN" | "FULFILLED" | "REJECTED" };
  };
  lms_assign_course: {
    params: { workerId: string; track: WorkerType };
    result: { assignmentId: string };
  };
  lms_get_completion: {
    params: { workerId: string; track: WorkerType };
    result: { completed: boolean };
  };
  calendar_schedule: {
    params: { title: string; attendees: string[]; date: string };
    result: { eventId: string };
  };
  email_send_template: {
    params: { to: string; template: string; vars: Record<string, string> };
    result: { messageId: string };
  };
}

export type ToolName = keyof ToolContract;

/** Implemented by the sandbox now and by real connectors later. */
export type SourceAdapter = {
  [K in ToolName]: (params: ToolContract[K]["params"]) => Promise<ToolContract[K]["result"]>;
};

export class ToolError extends Error {
  readonly retryable: boolean;

  constructor(message: string, retryable: boolean) {
    super(message);
    this.name = "ToolError";
    this.retryable = retryable;
  }
}

export interface InvokeContext {
  actor: string;
  caseId: string | null;
  /** Writes must carry a key. Reads omit it and are never cached. */
  requestKey?: string;
}

type Fn<K extends ToolName> = (params: ToolContract[K]["params"]) => Promise<ToolContract[K]["result"]>;

export class ToolRunner {
  constructor(
    private readonly adapter: SourceAdapter,
    private readonly store: Store,
    private readonly now: () => Date,
  ) {}

  async invoke<K extends ToolName>(
    tool: K,
    params: ToolContract[K]["params"],
    ctx: InvokeContext,
  ): Promise<ToolContract[K]["result"]> {
    const at = this.now().toISOString();
    const cacheKey = ctx.requestKey !== undefined ? `${tool}::${ctx.requestKey}` : null;

    if (cacheKey !== null && Object.prototype.hasOwnProperty.call(this.store.state.idempotency, cacheKey)) {
      this.store.appendAudit(
        { actor: ctx.actor, action: "tool.replayed", caseId: ctx.caseId, input: { tool, requestKey: ctx.requestKey }, output: null },
        at,
      );
      return this.store.state.idempotency[cacheKey] as ToolContract[K]["result"];
    }

    const call = (this.adapter[tool] as unknown as Fn<K>).bind(this.adapter);
    try {
      const result = await call(params);
      if (cacheKey !== null) this.store.state.idempotency[cacheKey] = result;
      this.store.appendAudit(
        { actor: ctx.actor, action: "tool.call", caseId: ctx.caseId, input: { tool, params, requestKey: ctx.requestKey }, output: { ok: true, result } },
        at,
      );
      return result;
    } catch (error) {
      this.store.appendAudit(
        {
          actor: ctx.actor,
          action: "tool.call",
          caseId: ctx.caseId,
          input: { tool, params, requestKey: ctx.requestKey },
          output: { ok: false, error: error instanceof Error ? error.message : String(error) },
        },
        at,
      );
      throw error;
    }
  }
}
