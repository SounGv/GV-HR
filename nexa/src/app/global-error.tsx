"use client";

/**
 * Root error boundary — catches errors thrown in the root/app layout that the
 * segment boundary can't. Renders the real error text so production failures are
 * diagnosable without dev tools. Must render its own <html>/<body>.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="th">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: 16,
          padding: 24,
          textAlign: "center",
        }}
      >
        <h1 style={{ fontSize: 18, fontWeight: 600 }}>เกิดข้อผิดพลาด (root)</h1>
        <pre
          style={{
            maxWidth: "100%",
            overflowX: "auto",
            background: "#fee",
            color: "#b00",
            border: "1px solid #f3caca",
            borderRadius: 8,
            padding: 12,
            fontSize: 12,
            textAlign: "left",
          }}
        >
          {(error?.name ? `${error.name}: ` : "") + (error?.message || "Unknown error")}
          {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        {error?.stack && (
          <pre
            style={{
              maxWidth: "100%",
              maxHeight: 240,
              overflow: "auto",
              background: "#f6f6f6",
              border: "1px solid #ddd",
              borderRadius: 8,
              padding: 12,
              fontSize: 11,
              textAlign: "left",
              color: "#444",
            }}
          >
            {error.stack}
          </pre>
        )}
        <button
          onClick={reset}
          style={{
            background: "#2563eb",
            color: "#fff",
            border: 0,
            borderRadius: 8,
            padding: "8px 16px",
            fontSize: 14,
            cursor: "pointer",
          }}
        >
          ลองใหม่อีกครั้ง
        </button>
      </body>
    </html>
  );
}
