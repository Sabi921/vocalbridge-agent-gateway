
import { useEffect, useState } from "react";
import api from "../api/client";
import AgentForm from "../components/AgentForm";

type Agent = {
  id: string;
  name: string;
  primaryProvider: "vendorA" | "vendorB";
  fallbackProvider?: "vendorA" | "vendorB" | null;
  systemPrompt: string;
  enabledTools?: string[];
};

export default function Agents() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);

  const loadAgents = async () => {
    try {
      setError(null);
      const res = await api.get("/agents");
      setAgents(res.data.agents || []);
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to load agents.");
    }
  };

  useEffect(() => {
    loadAgents();
  }, []);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert("Copied!");
    } catch {
      prompt("Copy this Agent ID:", text);
    }
  };

  return (
    <div>
      <h2>Agents</h2>

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button onClick={() => { setCreating(true); setEditing(null); }}>
          New Agent
        </button>
        <button onClick={loadAgents}>Refresh</button>
      </div>

      {error && <p style={{ marginTop: 12 }}>{error}</p>}

      {creating && (
        <AgentForm
          mode="create"
          onDone={async () => {
            setCreating(false);
            await loadAgents();
          }}
        />
      )}

      {editing && (
        <AgentForm
          mode="edit"
          initial={editing}
          onDone={async () => {
            setEditing(null);
            await loadAgents();
          }}
        />
      )}

      <div style={{ marginTop: 14 }}>
        {agents.length === 0 && !error && <p>No agents yet. Create one.</p>}

        {agents.map((a) => (
          <div
            key={a.id}
            style={{
              border: "1px solid #ddd",
              padding: 12,
              borderRadius: 10,
              marginTop: 10,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontWeight: 700 }}>{a.name}</div>
                <div style={{ opacity: 0.8, marginTop: 4 }}>
                  <span><b>ID:</b> {a.id}</span>{" "}
                  <button onClick={() => copy(a.id)} style={{ marginLeft: 8 }}>
                    Copy
                  </button>
                </div>
                <div style={{ opacity: 0.8, marginTop: 6 }}>
                  <b>Primary:</b> {a.primaryProvider}{" "}
                  {a.fallbackProvider ? (
                    <>
                      | <b>Fallback:</b> {a.fallbackProvider}
                    </>
                  ) : (
                    <>
                      | <b>Fallback:</b> none
                    </>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <button onClick={() => { setEditing(a); setCreating(false); }}>Edit</button>
              </div>
            </div>

            <details style={{ marginTop: 10 }}>
              <summary>Details</summary>
              <div style={{ marginTop: 8 }}>
                <div><b>System prompt:</b></div>
                <pre style={{ whiteSpace: "pre-wrap", padding: 10, borderRadius: 8 }}>
                  {a.systemPrompt}
                </pre>
                <div style={{ marginTop: 8 }}>
                  <b>Enabled tools:</b> {(a.enabledTools || []).join(", ") || "none"}
                </div>
              </div>
            </details>
          </div>
        ))}
      </div>
    </div>
  );
}
