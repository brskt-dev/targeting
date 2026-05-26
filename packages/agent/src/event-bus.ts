import type { AgentEvent } from "@targeting/shared";
import { EventEmitter } from "node:events";

// Barramento simples em processo. SSE handlers se inscrevem aqui.
class AgentEventBus extends EventEmitter {
  emitEvent(evt: AgentEvent): void {
    this.emit("agent", evt);
  }
  onEvent(handler: (evt: AgentEvent) => void): () => void {
    this.on("agent", handler);
    return () => this.off("agent", handler);
  }
}

export const agentBus = new AgentEventBus();
agentBus.setMaxListeners(100);
