
import { useEffect, useState } from "react";
import api from "../api/client";
import UsageTable from "../components/UsageTable";

function money(n: number) {
  return `$${Number(n || 0).toFixed(6)}`;
}

export default function Billing() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const from = "2025-12-30";
  const to = "2026-1-31";

  useEffect(() => {
    (async () => {
      try {
        setError(null);
        const res = await api.get(`/billing/usage?from=${from}&to=${to}`);
        setData(res.data);
      } catch (e: any) {
        setError(e?.response?.data?.message || "Failed to load usage.");
      }
    })();
  }, []);

  if (error) return <p>{error}</p>;
  if (!data) return <p>Loading usage…</p>;

  const totals = data.totals || {};
  const byProvider = data.byProvider || [];
  const topAgents = data.topAgents || [];

  return (
    <div>
      <h2>Usage & Analytics</h2>

      {/* Totals summary */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 12 }}>
        <div style={cardStyle}>
          <div style={labelStyle}>Sessions</div>
          <div style={valueStyle}>{totals.sessions ?? 0}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Tokens</div>
          <div style={valueStyle}>{totals.tokens ?? 0}</div>
        </div>
        <div style={cardStyle}>
          <div style={labelStyle}>Cost</div>
          <div style={valueStyle}>{money(totals.costUsd ?? 0)}</div>
        </div>
      </div>

      {/* Provider breakdown */}
      <h3 style={{ marginTop: 22 }}>Breakdown by Provider</h3>
      <UsageTable
        rows={byProvider}
        columns={[
          { header: "Provider", cell: (r: any) => r.provider },
          { header: "Sessions", cell: (r: any) => r.sessions ?? 0 },
          { header: "Tokens In", cell: (r: any) => r.tokensIn ?? 0 },
          { header: "Tokens Out", cell: (r: any) => r.tokensOut ?? 0 },
          { header: "Total Tokens", cell: (r: any) => r.tokens ?? (r.tokensIn ?? 0) + (r.tokensOut ?? 0) },
          { header: "Cost", cell: (r: any) => money(r.costUsd ?? 0) },
        ]}
        emptyText="No provider usage in this range."
      />

      {/* Top agents */}
      <h3 style={{ marginTop: 22 }}>Top Agents by Cost</h3>
      <UsageTable
        rows={topAgents}
        columns={[
          { header: "Agent", cell: (r: any) => r.agentName ?? r.agentId },
          { header: "Sessions", cell: (r: any) => r.sessions ?? 0 },
          { header: "Tokens", cell: (r: any) => r.tokens ?? 0 },
          { header: "Cost", cell: (r: any) => money(r.costUsd ?? 0) },
        ]}
        emptyText="No agent usage in this range."
      />

      <p style={{ marginTop: 16, opacity: 0.8 }}>
        Range: {from} → {to}
      </p>
    </div>
  );
}

const cardStyle: React.CSSProperties = {
  border: "1px solid #ddd",
  borderRadius: 10,
  padding: 12,
  minWidth: 160,
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  opacity: 0.75,
};

const valueStyle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
};
