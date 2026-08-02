export function ProductHuntCard() {
  return (
    <div
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        border: "1px solid rgb(224, 224, 224)",
        borderRadius: 12,
        padding: 20,
        maxWidth: 500,
        background: "rgb(255, 255, 255)",
        boxShadow: "rgba(0, 0, 0, 0.05) 0px 2px 8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
        <img
          alt="Alpha Brain"
          src="https://ph-files.imgix.net/7c28d5cf-2b7b-423c-afaf-e74cb8335ebf.png?auto=compress,format&codec=mozjpeg&cs=strip&fit=crop&h=80&w=80"
          style={{ width: 64, height: 64, borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
        />
        <div style={{ flex: "1 1 0%", minWidth: 0 }}>
          <h3
            style={{
              margin: 0,
              fontSize: 18,
              fontWeight: 600,
              color: "rgb(26, 26, 26)",
              lineHeight: 1.3,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            Alpha Brain
          </h3>
          <p
            style={{
              margin: "4px 0px 0px",
              fontSize: 14,
              color: "rgb(102, 102, 102)",
              lineHeight: 1.4,
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            STOCK , CRYPTO
          </p>
        </div>
      </div>
      <a
        href="https://www.producthunt.com/products/alpha-brain?embed=true&utm_source=embed&utm_medium=post_embed"
        target="_blank"
        rel="noopener"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 4,
          marginTop: 12,
          padding: "8px 16px",
          background: "rgb(255, 97, 84)",
          color: "rgb(255, 255, 255)",
          textDecoration: "none",
          borderRadius: 8,
          fontSize: 14,
          fontWeight: 600,
        }}
      >
        Check it out on Product Hunt →
      </a>
    </div>
  );
}
