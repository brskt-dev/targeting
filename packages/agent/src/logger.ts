import type {
  AgentLog,
  AgentLogEventType,
  AgentLogLevel,
} from "@targeting/shared";
import { saveLog } from "@targeting/storage";
import { agentBus } from "./event-bus";
import { randomUUID } from "node:crypto";

export type LogContext = {
  runId?: string;
  connectionId?: string;
};

export function log(
  ctx: LogContext,
  level: AgentLogLevel,
  event: AgentLogEventType,
  message: string,
  data?: Record<string, unknown>,
): AgentLog {
  const record: AgentLog = {
    id: randomUUID(),
    runId: ctx.runId,
    connectionId: ctx.connectionId,
    ts: new Date().toISOString(),
    level,
    event,
    message,
    data,
  };
  saveLog(record);
  agentBus.emitEvent(record);
  return record;
}
