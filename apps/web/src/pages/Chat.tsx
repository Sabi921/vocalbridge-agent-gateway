
import { useEffect, useState } from "react";
import api from "../api/client";

type Agent = { id: string; name: string };

export default function Chat() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [agentId, setAgentId] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  // load agents for dropdown
  useEffect(() => {
    (async () => {
      try {
        const res = await api.get("/agents");
        const list = (res.data.agents || []).map((a: any) => ({ id: a.id, name: a.name }));
        setAgents(list);
        if (list.length && !agentId) setAgentId(list[0].id);
      } catch (e: any) {
        setError(e?.response?.data?.message || "Failed to load agents.");
      }
    })();
  }, []);

  const startSession = async () => {
    setError(null);
    setSessionId("");
    setMessages([]);

    try {
      const res = await api.post("/gateway/sessions", {
        agentId,
        customerId: "demo-user",
        metadata: { channel: "chat" },
      });
      setSessionId(res.data.sessionId);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to start session.");
    }
  };

  const send = async () => {
    if (!sessionId) {
      setError("Start a session first.");
      return;
    }
    if (!input.trim()) return;

    setError(null);
    const content = input.trim();
    setInput("");

    // simple idempotency key
    const idempotencyKey = `ui-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setMessages((m) => [...m, { role: "user", content }]);

    try {
      const res = await api.post(`/gateway/sessions/${sessionId}/messages`, {
        content,
        idempotencyKey,
      });

      setMessages((m) => [...m, { role: "assistant", content: res.data.reply }]);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to send message.");
    }
  };

  return (
    <div>
      <h2>Try It (Chat)</h2>

      {error && <p style={{ marginTop: 10 }}>{error}</p>}

      <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 12 }}>
        <label>
          Agent{" "}
          <select value={agentId} onChange={(e) => setAgentId(e.target.value)}>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.id.slice(0, 6)}…)
              </option>
            ))}
          </select>
        </label>

        <button onClick={startSession} disabled={!agentId}>
          Start Session
        </button>

        <span style={{ opacity: 0.8 }}>
          {sessionId ? (
            <>
              <b>Session Started:</b> {sessionId.slice(0, 10)}…
            </>
          ) : (
            "No session yet"
          )}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type message…"
          style={{ flex: 1, padding: 8 }}
          onKeyDown={(e) => {
            if (e.key === "Enter") send();
          }}
        />
        <button onClick={send} disabled={!sessionId}>
          Send
        </button>
      </div>

      <div style={{ marginTop: 16, border: "1px solid #ddd", borderRadius: 10, padding: 12, minHeight: 220 }}>
        {messages.length === 0 ? (
          <p style={{ opacity: 0.8 }}>Start a session, then send a message.</p>
        ) : (
          messages.map((m, i) => (
            <div key={i} style={{ marginBottom: 10 }}>
              <b>{m.role}:</b> {m.content}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
