
import { useEffect, useState } from "react";
import api from "../api/client";

type Agent = {
  id: string;
  name: string;
  primaryProvider: "vendorA" | "vendorB";
  fallbackProvider?: "vendorA" | "vendorB" | null;
  systemPrompt: string;
  enabledTools?: string[]; // optional
};

export default function AgentForm({
  mode,
  initial,
  onDone,
}: {
  mode: "create" | "edit";
  initial?: Agent;
  onDone: () => void;
}) {
  const [name, setName] = useState(initial?.name || "");
  const [primaryProvider, setPrimary] = useState<"vendorA" | "vendorB">(
    initial?.primaryProvider || "vendorA"
  );
  const [fallbackProvider, setFallback] = useState<string>(
    initial?.fallbackProvider || ""
  );
  const [systemPrompt, setPrompt] = useState(initial?.systemPrompt || "");
  const [enabledToolsText, setEnabledToolsText] = useState(
    (initial?.enabledTools || []).join(", ")
  );
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initial) {
      setName(initial.name);
      setPrimary(initial.primaryProvider);
      setFallback(initial.fallbackProvider || "");
      setPrompt(initial.systemPrompt);
      setEnabledToolsText((initial.enabledTools || []).join(", "));
    }
  }, [initial?.id]);

  const submit = async () => {
    setError(null);

    const enabledTools = enabledToolsText
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

    const payload = {
      name,
      primaryProvider,
      fallbackProvider: fallbackProvider || null,
      systemPrompt,
      enabledTools,
    };

    try {
      if (mode === "create") {
        await api.post("/agents", payload);
      } else {
        if (!initial?.id) throw new Error("Missing agent id");
        await api.put(`/agents/${initial.id}`, payload);
      }
      onDone();
    } catch (e: any) {
      setError(e?.response?.data?.message || "Failed to save agent.");
    }
  };

  return (
    <div style={{ border: "1px solid #ddd", padding: 12, borderRadius: 10, marginTop: 12 }}>
      <h3 style={{ marginTop: 0 }}>{mode === "create" ? "Create Agent" : "Edit Agent"}</h3>

      <div style={{ display: "grid", gap: 8, maxWidth: 520 }}>
        <label>
          Name
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%" }} />
        </label>

        <label>
          Primary Provider
          <select value={primaryProvider} onChange={(e) => setPrimary(e.target.value as any)} style={{ width: "100%" }}>
            <option value="vendorA">vendorA</option>
            <option value="vendorB">vendorB</option>
          </select>
        </label>

        <label>
          Fallback Provider (optional)
          <select value={fallbackProvider} onChange={(e) => setFallback(e.target.value)} style={{ width: "100%" }}>
            <option value="">None</option>
            <option value="vendorA">vendorA</option>
            <option value="vendorB">vendorB</option>
          </select>
        </label>

        <label>
          System Prompt
          <textarea value={systemPrompt} onChange={(e) => setPrompt(e.target.value)} rows={4} style={{ width: "100%" }} />
        </label>

        <label>
          Enabled Tools (comma-separated)
          <input
            value={enabledToolsText}
            onChange={(e) => setEnabledToolsText(e.target.value)}
            placeholder="InvoiceLookup, ..."
            style={{ width: "100%" }}
          />
        </label>

        {error && <p style={{ margin: 0 }}>{error}</p>}

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={submit}>{mode === "create" ? "Create" : "Save"}</button>
          <button onClick={onDone} type="button">Cancel</button>
        </div>
      </div>
    </div>
  );
}
