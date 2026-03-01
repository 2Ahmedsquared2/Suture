"use client";

import { useMemo } from "react";

interface ContourGraphicProps {
  className?: string;
  width?: number;
  height?: number;
  lineCount?: number;
  variant?: "hero" | "background";
}

function smoothPath(points: [number, number][]): string {
  const n = points.length;
  if (n < 3) return "";

  const mid = (i: number): [number, number] => [
    (points[i % n][0] + points[(i + 1) % n][0]) / 2,
    (points[i % n][1] + points[(i + 1) % n][1]) / 2,
  ];

  let d = `M ${mid(0)[0].toFixed(1)} ${mid(0)[1].toFixed(1)}`;
  for (let i = 1; i <= n; i++) {
    const cp = points[i % n];
    const end = mid(i);
    d += ` Q ${cp[0].toFixed(1)} ${cp[1].toFixed(1)} ${end[0].toFixed(1)} ${end[1].toFixed(1)}`;
  }
  return d + " Z";
}

function generateContourPaths(
  width: number,
  height: number,
  lineCount: number,
  variant: "hero" | "background"
) {
  const cx = width * 0.48;
  const cy = height * 0.46;
  const maxR = Math.min(width, height) * (variant === "hero" ? 0.42 : 0.38);
  const minR = maxR * 0.04;
  const paths: { d: string; opacity: number }[] = [];

  for (let i = 0; i < lineCount; i++) {
    const t = Math.pow((i + 1) / lineCount, 1.4);
    const baseR = minR + t * (maxR - minR);
    const numPts = 100;
    const points: [number, number][] = [];

    for (let j = 0; j < numPts; j++) {
      const theta = (j / numPts) * Math.PI * 2;

      const shape =
        1 +
        0.35 * Math.sin(theta + 0.15) +
        0.18 * Math.cos(2 * theta - 0.1) +
        0.09 * Math.sin(3 * theta + 0.4) -
        0.06 * Math.cos(4 * theta + 0.3);

      const waveAmp = 2 + t * 14;
      const wave =
        Math.sin(5 * theta + i * 0.65) * waveAmp * 0.5 +
        Math.cos(8 * theta - i * 0.45) * waveAmp * 0.3 +
        Math.sin(13 * theta + i * 1.2) * waveAmp * 0.15;

      const r = baseR * shape + wave;
      const x = cx + Math.cos(theta) * r;
      const y = cy + Math.sin(theta) * r * 0.82;

      points.push([x, y]);
    }

    const opacity = 0.12 + t * 0.58;
    paths.push({ d: smoothPath(points), opacity });
  }

  return paths;
}

export default function ContourGraphic({
  className = "",
  width = 800,
  height = 800,
  lineCount = 28,
  variant = "hero",
}: ContourGraphicProps) {
  const paths = useMemo(
    () => generateContourPaths(width, height, lineCount, variant),
    [width, height, lineCount, variant]
  );

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke="white"
          strokeWidth={0.7}
          opacity={p.opacity}
        />
      ))}
    </svg>
  );
}
