
type Column<T> = {
  header: string;
  cell: (row: T) => React.ReactNode;
};

export default function UsageTable<T>({
  columns,
  rows,
  emptyText = "No data",
}: {
  columns: Column<T>[];
  rows: T[];
  emptyText?: string;
}) {
  if (!rows || rows.length === 0) {
    return <p>{emptyText}</p>;
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          marginTop: 12,
        }}
      >
        <thead>
          <tr>
            {columns.map((c, idx) => (
              <th
                key={idx}
                style={{
                  textAlign: "left",
                  padding: "10px 8px",
                  borderBottom: "1px solid #ddd",
                  whiteSpace: "nowrap",
                }}
              >
                {c.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {rows.map((row, rIdx) => (
            <tr key={rIdx}>
              {columns.map((c, cIdx) => (
                <td
                  key={cIdx}
                  style={{
                    padding: "10px 8px",
                    borderBottom: "1px solid #eee",
                    verticalAlign: "top",
                  }}
                >
                  {c.cell(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
