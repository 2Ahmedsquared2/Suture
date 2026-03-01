"use client";

import { useMemo } from "react";

interface ContourGraphicProps {
  className?: string;
  width?: number;
  height?: number;
  lineCount?: number;
  animate?: boolean;
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
  lineCount: number
) {
  const cx = width * 0.5;
  const cy = height * 0.47;
  const maxR = Math.min(width, height) * 0.43;
  const minR = maxR * 0.025;
  const paths: { d: string; opacity: number; width: number }[] = [];

  for (let i = 0; i < lineCount; i++) {
    const t = Math.pow((i + 1) / lineCount, 1.3);
    const baseR = minR + t * (maxR - minR);
    const numPts = 120;
    const points: [number, number][] = [];

    for (let j = 0; j < numPts; j++) {
      const theta = (j / numPts) * Math.PI * 2;

      // Butterfly / wing shape:
      // - cos(2θ) inverted → top/bottom lobes instead of side lobes
      // - sin(θ) → top-heavy
      // - cos(4θ) inverted → splits the top into two wings
      const shape =
        1 -
        0.45 * Math.cos(2 * theta) +
        0.38 * Math.sin(theta) -
        0.3 * Math.cos(4 * theta) +
        0.06 * Math.sin(3 * theta + 0.3);

      // Organic waviness — proportional to contour size
      const wAmp = Math.max(1, baseR * 0.06) + t * 18;
      const wave =
        Math.sin(5 * theta + i * 0.55) * wAmp * 0.4 +
        Math.cos(7 * theta - i * 0.38) * wAmp * 0.28 +
        Math.sin(11 * theta + i * 1.1) * wAmp * 0.13 +
        Math.cos(17 * theta - i * 0.7) * wAmp * 0.05;

      const r = Math.max(0.5, baseR * shape + wave);
      const x = cx + Math.cos(theta) * r;
      const y = cy - Math.sin(theta) * r * 1.05;

      points.push([x, y]);
    }

    const opacity = 0.06 + t * 0.64;
    const strokeW = 0.4 + t * 0.5;
    paths.push({ d: smoothPath(points), opacity, width: strokeW });
  }

  return paths;
}

export default function ContourGraphic({
  className = "",
  width = 800,
  height = 800,
  lineCount = 32,
  animate = false,
}: ContourGraphicProps) {
  const paths = useMemo(
    () => generateContourPaths(width, height, lineCount),
    [width, height, lineCount]
  );

  const DASH_LENGTH = 4000;
  const DRAW_DURATION = 1.6;
  const STAGGER = 0.06;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {animate && (
        <style>{`
          @keyframes stitch-draw {
            from { stroke-dashoffset: ${DASH_LENGTH}; }
            to   { stroke-dashoffset: 0; }
          }
        `}</style>
      )}
      {paths.map((p, i) => (
        <path
          key={i}
          d={p.d}
          stroke="white"
          strokeWidth={p.width}
          opacity={p.opacity}
          {...(animate && {
            strokeDasharray: DASH_LENGTH,
            strokeDashoffset: DASH_LENGTH,
            style: {
              animation: `stitch-draw ${DRAW_DURATION}s ease-out ${(i * STAGGER).toFixed(2)}s forwards`,
            },
          })}
        />
      ))}
    </svg>
  );
}
