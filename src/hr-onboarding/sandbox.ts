import { ToolError, ToolName, SourceAdapter, ToolContract } from "./tools";

// In-memory stand-in for Workday, ServiceNow, the LMS, calendar and email.
// Used by tests and for dry runs until real connectors exist (discovery U3, U4).
// Failure injection reproduces the spec's outage scenarios.

interface Failure {
  remaining: number;
  message: string;
  retryable: boolean;
}

export class SandboxSystems implements SourceAdapter {
  /** Successful writes only. Tests use this to prove no duplicates were created. */
  readonly sideEffects: { tool: ToolName; params: unknown }[] = [];

  private readonly linked = new Map<string, { workerId: string; workerType: string }[]>();
  private readonly failures = new Map<ToolName, Failure>();
  private seq = 0;

  setLinkedRecords(workerId: string, records: { workerId: string; workerType: string }[]): void {
    this.linked.set(workerId, records);
  }

  failTool(tool: ToolName, times: number, message: string, retryable = true): void {
    this.failures.set(tool, { remaining: times, message, retryable });
  }

  recover(tool: ToolName): void {
    this.failures.delete(tool);
  }

  private guard(tool: ToolName): void {
    const failure = this.failures.get(tool);
    if (!failure || failure.remaining <= 0) return;
    failure.remaining -= 1;
    throw new ToolError(failure.message, failure.retryable);
  }

  private effect(tool: ToolName, params: unknown, prefix: string): string {
    this.guard(tool);
    this.sideEffects.push({ tool, params });
    this.seq += 1;
    return `${prefix}-${this.seq}`;
  }

  async workday_get_worker(params: ToolContract["workday_get_worker"]["params"]) {
    this.guard("workday_get_worker");
    return { workerId: params.workerId, linkedRecords: this.linked.get(params.workerId) ?? [] };
  }

  async servicenow_create_request(params: ToolContract["servicenow_create_request"]["params"]) {
    return { requestId: this.effect("servicenow_create_request", params, "REQ") };
  }

  async servicenow_get_status(params: ToolContract["servicenow_get_status"]["params"]) {
    this.guard("servicenow_get_status");
    void params;
    return { status: "OPEN" as const };
  }

  async lms_assign_course(params: ToolContract["lms_assign_course"]["params"]) {
    return { assignmentId: this.effect("lms_assign_course", params, "LMS") };
  }

  async lms_get_completion(params: ToolContract["lms_get_completion"]["params"]) {
    this.guard("lms_get_completion");
    void params;
    return { completed: false };
  }

  async calendar_schedule(params: ToolContract["calendar_schedule"]["params"]) {
    return { eventId: this.effect("calendar_schedule", params, "CAL") };
  }

  async email_send_template(params: ToolContract["email_send_template"]["params"]) {
    return { messageId: this.effect("email_send_template", params, "MAIL") };
  }
}
