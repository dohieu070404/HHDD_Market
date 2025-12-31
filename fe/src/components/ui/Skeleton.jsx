/**
 * Skeleton loading block
 * Usage:
 *  <Skeleton style={{ height: 16, width: 160 }} />
 *  <Skeleton style={{ height: 96, width: "100%" }} />
 */
export default function Skeleton({ className, style, rounded = "md" }) {
  const radius = rounded === "full" ? "999px" : rounded === "lg" ? "16px" : "12px";
  return (
    <div
      className={className ? `skeleton ${className}` : "skeleton"}
      style={{ borderRadius: radius, ...(style || {}) }}
      aria-hidden="true"
    />
  );
}
