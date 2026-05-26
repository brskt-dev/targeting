"use client";

import { useEffect, useState } from "react";
import type { AgentLog } from "@targeting/shared";
import { api } from "@/lib/api";

export function useAgentEvents(filter: { connectionId?: string; runId?: string }) {
  const [events, setEvents] = useState<AgentLog[]>([]);

  useEffect(() => {
    setEvents([]);
    if (!filter.connectionId && !filter.runId) return;
    const es = new EventSource(api.eventsUrl(filter));
    es.onmessage = (ev) => {
      try {
        const log: AgentLog = JSON.parse(ev.data);
        setEvents((prev) => [...prev.slice(-500), log]);
      } catch {
        // ignore
      }
    };
    return () => es.close();
  }, [filter.connectionId, filter.runId]);

  return events;
}
