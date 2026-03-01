"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type GarmentType = "tshirt" | "crewneck" | "hoodie";
type GarmentColor = "black" | "gray" | "white";
type GarmentSide = "front" | "back";

interface GarmentMockupProps {
  designImageUrl: string;
}

const FILL: Record<GarmentColor, string> = {
  black: "#1a1a1a",
  gray: "#6b6b6b",
  white: "#e8e8e8",
};

const STROKE: Record<GarmentColor, string> = {
  black: "#333",
  gray: "#888",
  white: "#bbb",
};

const PATHS: Record<
  GarmentType,
  Record<GarmentSide, { body: string; details?: string[] }>
> = {
  tshirt: {
    front: {
      body: "M92,48 C110,72 150,72 168,48 L206,62 L248,116 L236,128 L192,102 L192,296 C192,308 184,314 176,314 L84,314 C76,314 68,308 68,296 L68,102 L24,128 L12,116 L54,62 Z",
    },
    back: {
      body: "M92,52 C110,62 150,62 168,52 L206,62 L248,116 L236,128 L192,102 L192,296 C192,308 184,314 176,314 L84,314 C76,314 68,308 68,296 L68,102 L24,128 L12,116 L54,62 Z",
    },
  },
  crewneck: {
    front: {
      body: "M96,48 C112,68 148,68 164,48 L200,60 L252,182 L238,192 L192,114 L192,296 C192,308 184,314 176,314 L84,314 C76,314 68,308 68,296 L68,114 L22,192 L8,182 L60,60 Z",
    },
    back: {
      body: "M96,52 C112,58 148,58 164,52 L200,60 L252,182 L238,192 L192,114 L192,296 C192,308 184,314 176,314 L84,314 C76,314 68,308 68,296 L68,114 L22,192 L8,182 L60,60 Z",
    },
  },
  hoodie: {
    front: {
      body: "M96,48 C112,68 148,68 164,48 L200,60 L252,182 L238,192 L192,114 L192,296 C192,308 184,314 176,314 L84,314 C76,314 68,308 68,296 L68,114 L22,192 L8,182 L60,60 Z",
      details: [
        "M78,54 C78,4 182,4 182,54",
        "M90,210 Q130,232 170,210",
        "M120,68 L122,92",
        "M140,68 L138,92",
      ],
    },
    back: {
      body: "M96,52 C112,58 148,58 164,52 L200,60 L252,182 L238,192 L192,114 L192,296 C192,308 184,314 176,314 L84,314 C76,314 68,308 68,296 L68,114 L22,192 L8,182 L60,60 Z",
      details: ["M78,54 C78,0 182,0 182,54"],
    },
  },
};

const GARMENT_LABELS: Record<GarmentType, string> = {
  tshirt: "T-Shirt",
  crewneck: "Crewneck",
  hoodie: "Hoodie",
};

export default function GarmentMockup({ designImageUrl }: GarmentMockupProps) {
  const [garmentType, setGarmentType] = useState<GarmentType>("tshirt");
  const [garmentColor, setGarmentColor] = useState<GarmentColor>("black");
  const [side, setSide] = useState<GarmentSide>("front");

  // Design position/size in SVG viewBox coords (0 0 260 320)
  const [designX, setDesignX] = useState(88);
  const [designY, setDesignY] = useState(110);
  const [designW, setDesignW] = useState(84);
  const [imageAspect, setImageAspect] = useState(1);

  const svgRef = useRef<SVGSVGElement>(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const resizeStart = useRef({ dist: 0, w: 0, cx: 0, cy: 0 });

  const garment = PATHS[garmentType][side];
  const designH = designW * imageAspect;

  useEffect(() => {
    const img = new window.Image();
    img.onload = () => {
      if (img.naturalWidth > 0) {
        setImageAspect(img.naturalHeight / img.naturalWidth);
      }
    };
    img.src = designImageUrl;
  }, [designImageUrl]);

  const toSvg = useCallback((clientX: number, clientY: number) => {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const s = pt.matrixTransform(ctm.inverse());
    return { x: s.x, y: s.y };
  }, []);

  const handleDesignDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const pt = toSvg(clientX, clientY);
      dragStart.current = { mx: pt.x, my: pt.y, ox: designX, oy: designY };
    },
    [toSvg, designX, designY]
  );

  const handleCornerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing.current = true;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const pt = toSvg(clientX, clientY);
      const cx = designX + designW / 2;
      const cy = designY + designH / 2;
      resizeStart.current = {
        dist: Math.hypot(pt.x - cx, pt.y - cy) || 1,
        w: designW,
        cx,
        cy,
      };
    },
    [toSvg, designX, designY, designW, designH]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX =
        "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY =
        "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const pt = toSvg(clientX, clientY);

      if (isDragging.current) {
        setDesignX(dragStart.current.ox + (pt.x - dragStart.current.mx));
        setDesignY(dragStart.current.oy + (pt.y - dragStart.current.my));
      }

      if (isResizing.current) {
        const { dist, w, cx, cy } = resizeStart.current;
        const curDist = Math.hypot(pt.x - cx, pt.y - cy) || 1;
        const ratio = curDist / dist;
        const newW = Math.max(20, Math.min(200, w * ratio));
        const newH = newW * imageAspect;
        setDesignW(newW);
        setDesignX(cx - newW / 2);
        setDesignY(cy - newH / 2);
      }
    };

    const onUp = () => {
      isDragging.current = false;
      isResizing.current = false;
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [toSvg, imageAspect]);

  const cornerSize = 5;
  const corners = [
    { x: designX, y: designY },
    { x: designX + designW, y: designY },
    { x: designX, y: designY + designH },
    { x: designX + designW, y: designY + designH },
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Garment type */}
      <div className="flex items-center gap-1 rounded-lg bg-white/4 p-1">
        {(["tshirt", "crewneck", "hoodie"] as GarmentType[]).map((t) => (
          <button
            key={t}
            onClick={() => setGarmentType(t)}
            className={`rounded-md px-4 py-1.5 text-xs transition-all ${
              garmentType === t
                ? "bg-white/8 text-accent"
                : "text-foreground/40 hover:text-foreground/60"
            }`}
          >
            {GARMENT_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Color + side */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          {(["black", "gray", "white"] as GarmentColor[]).map((c) => (
            <button
              key={c}
              onClick={() => setGarmentColor(c)}
              className={`h-6 w-6 rounded-full border-2 transition-all ${
                garmentColor === c ? "border-accent scale-110" : "border-white/20"
              }`}
              style={{ backgroundColor: FILL[c] }}
              title={c}
            />
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg bg-white/4 p-1">
          {(["front", "back"] as GarmentSide[]).map((s) => (
            <button
              key={s}
              onClick={() => setSide(s)}
              className={`rounded-md px-3 py-1 text-xs capitalize transition-all ${
                side === s
                  ? "bg-white/8 text-accent"
                  : "text-foreground/40 hover:text-foreground/60"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Garment SVG with design overlay */}
      <svg
        ref={svgRef}
        viewBox="0 0 260 320"
        className="w-full max-w-xs select-none"
        style={{ maxHeight: "52vh" }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <clipPath id="garment-clip">
            <path d={garment.body} />
          </clipPath>
        </defs>

        {/* Details behind body (hood, etc.) */}
        {garment.details?.map((d, i) => (
          <path
            key={`detail-${i}`}
            d={d}
            fill={i === 0 ? FILL[garmentColor] : "none"}
            stroke={STROKE[garmentColor]}
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        ))}

        {/* Garment body */}
        <path
          d={garment.body}
          fill={FILL[garmentColor]}
          stroke={STROKE[garmentColor]}
          strokeWidth="1.5"
        />

        {/* Design image clipped to garment */}
        <g clipPath="url(#garment-clip)">
          <image
            href={designImageUrl}
            x={designX}
            y={designY}
            width={designW}
            height={designH}
            preserveAspectRatio="xMidYMid meet"
            style={{ cursor: "move" }}
            onMouseDown={handleDesignDown}
            onTouchStart={handleDesignDown}
          />
        </g>

        {/* Bounding box */}
        <rect
          x={designX}
          y={designY}
          width={designW}
          height={designH}
          fill="none"
          stroke="#e97319"
          strokeWidth="0.8"
          strokeDasharray="3 2"
          opacity="0.6"
          pointerEvents="none"
        />

        {/* Corner handles */}
        {corners.map((c, i) => (
          <rect
            key={i}
            x={c.x - cornerSize / 2}
            y={c.y - cornerSize / 2}
            width={cornerSize}
            height={cornerSize}
            rx="1"
            fill="#e97319"
            stroke="#0a0a0a"
            strokeWidth="0.5"
            style={{ cursor: "nwse-resize" }}
            onMouseDown={handleCornerDown}
            onTouchStart={handleCornerDown}
          />
        ))}
      </svg>

      <p className="text-xs text-foreground/25">
        Drag to move · Drag corners to resize
      </p>
    </div>
  );
}
