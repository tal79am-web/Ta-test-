import * as fs from "fs";
import { AuditEntry, StoreState } from "./types";

function emptyState(): StoreState {
  return { cases: {}, tasks: {}, flags: {}, audit: [], idempotency: {} };
}

/**
 * Case state persisted outside the process (R9). With a file path the whole
 * state is written atomically (temp file, then rename) on every save().
 * Without a path it is kept in memory, which is what tests use.
 */
export class Store {
  readonly state: StoreState;

  constructor(private readonly file?: string) {
    this.state =
      file && fs.existsSync(file)
        ? (JSON.parse(fs.readFileSync(file, "utf8")) as StoreState)
        : emptyState();
  }

  save(): void {
    if (!this.file) return;
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.state));
    fs.renameSync(tmp, this.file);
  }

  appendAudit(entry: Omit<AuditEntry, "seq" | "at">, at: string): void {
    this.state.audit.push({ seq: this.state.audit.length + 1, at, ...entry });
  }
}
