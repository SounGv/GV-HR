import type { CSSProperties } from "react";

export function Icon({
  name,
  size = 20,
  fill = false,
  className,
  style,
}: {
  name: string;
  size?: number;
  fill?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <span
      className={`material-symbols-rounded${className ? ` ${className}` : ""}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}`,
        ...style,
      }}
    >
      {name}
    </span>
  );
}
