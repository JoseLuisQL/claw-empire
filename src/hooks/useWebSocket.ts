import { useEffect, useRef, useCallback, useState } from "react";
import type { WSEvent, WSEventType } from "../types";

type Listener = (payload: unknown) => void;

export function useWebSocket() {
  const wsRef = useRef<WebSocket | null>(null);
  const listenersRef = useRef<Map<WSEventType, Set<Listener>>>(new Map());
  const [connected, setConnected] = useState(false);
  const authToken = (import.meta.env.VITE_API_AUTH_TOKEN as string | undefined)?.trim() ?? '';

  useEffect(() => {
    const proto = location.protocol === "https:" ? "wss:" : "ws:";
    const wsAuth = authToken ? `?auth=${encodeURIComponent(authToken)}` : "";
    const url = `${proto}//${location.host}/ws${wsAuth}`;
    let alive = true;
    let ws: WebSocket;
    let reconnectTimer: ReturnType<typeof setTimeout>;

    async function connect() {
      if (!alive) return;
      try {
        await fetch('/api/auth/session', {
          method: 'GET',
          headers: authToken ? { authorization: `Bearer ${authToken}` } : undefined,
          credentials: 'same-origin',
        });
      } catch {
        // ignore bootstrap errors; ws connect result will drive retry
      }
      ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        if (alive) setConnected(true);
      };
      ws.onclose = () => {
        if (!alive) return;
        setConnected(false);
        reconnectTimer = setTimeout(() => { void connect(); }, 2000);
      };
      ws.onerror = () => ws.close();
      ws.onmessage = (e) => {
        if (!alive) return;
        try {
          const evt: WSEvent = JSON.parse(e.data);
          const listeners = listenersRef.current.get(evt.type);
          if (listeners) {
            for (const fn of listeners) fn(evt.payload);
          }
        } catch {}
      };
    }

    void connect();
    return () => {
      alive = false;
      clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, [authToken]);

  const on = useCallback((type: WSEventType, fn: Listener) => {
    if (!listenersRef.current.has(type)) {
      listenersRef.current.set(type, new Set());
    }
    listenersRef.current.get(type)!.add(fn);
    return () => { listenersRef.current.get(type)?.delete(fn); };
  }, []);

  return { connected, on };
}
