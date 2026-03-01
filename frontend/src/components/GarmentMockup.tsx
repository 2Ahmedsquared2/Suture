"use client";

import { useState, useRef, useCallback, useEffect } from "react";

type GarmentType = "tshirt" | "crewneck" | "hoodie";
type GarmentColor = "white" | "gray" | "black";

interface GarmentMockupProps {
  designImageUrl: string;
}

const GARMENT_LABELS: Record<GarmentType, string> = {
  tshirt: "T-Shirt",
  crewneck: "Crewneck",
  hoodie: "Hoodie",
};

const GARMENT_IMAGES: Record<GarmentType, Record<GarmentColor, string>> = {
  tshirt: {
    white: "/mockups/tshirt.png",
    gray: "/mockups/tshirt.png",
    black: "/mockups/tshirt-black.png",
  },
  hoodie: {
    white: "/mockups/hoodie.png",
    gray: "/mockups/hoodie.png",
    black: "/mockups/hoodie.png",
  },
  crewneck: {
    white: "/mockups/crewneck.png",
    gray: "/mockups/crewneck.png",
    black: "/mockups/crewneck.png",
  },
};

const GARMENT_FILTERS: Record<GarmentType, Record<GarmentColor, string>> = {
  tshirt: {
    white: "none",
    gray: "brightness(0.55)",
    black: "none",
  },
  hoodie: {
    white: "none",
    gray: "brightness(0.55)",
    black: "brightness(0.18)",
  },
  crewneck: {
    white: "saturate(0) brightness(1.45)",
    gray: "saturate(0) brightness(0.72)",
    black: "saturate(0) brightness(0.18)",
  },
};

const PRINT_ZONES: Record<GarmentType, { x: number; y: number; w: number }> = {
  tshirt: { x: 28, y: 22, w: 44 },
  hoodie: { x: 25, y: 38, w: 46 },
  crewneck: { x: 24, y: 18, w: 48 },
};

const COLOR_SWATCHES: Record<GarmentColor, string> = {
  white: "#e8e8e8",
  gray: "#6b6b6b",
  black: "#1a1a1a",
};

export default function GarmentMockup({ designImageUrl }: GarmentMockupProps) {
  const [garmentType, setGarmentType] = useState<GarmentType>("tshirt");
  const [garmentColor, setGarmentColor] = useState<GarmentColor>("black");

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragStart = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });
  const resizeStart = useRef({ mx: 0, my: 0, ow: 0 });

  const printZone = PRINT_ZONES[garmentType];
  const [designX, setDesignX] = useState(printZone.x + printZone.w * 0.1);
  const [designY, setDesignY] = useState(printZone.y + 2);
  const [designW, setDesignW] = useState(printZone.w * 0.7);
  const [imageAspect, setImageAspect] = useState(1);

  const garmentSrc = GARMENT_IMAGES[garmentType][garmentColor];
  const garmentFilter = GARMENT_FILTERS[garmentType][garmentColor];
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

  useEffect(() => {
    const pz = PRINT_ZONES[garmentType];
    setDesignX(pz.x + pz.w * 0.1);
    setDesignY(pz.y + 2);
    setDesignW(pz.w * 0.7);
  }, [garmentType]);

  const toPercent = useCallback((clientX: number, clientY: number) => {
    const el = containerRef.current;
    if (!el) return { x: 0, y: 0 };
    const rect = el.getBoundingClientRect();
    return {
      x: ((clientX - rect.left) / rect.width) * 100,
      y: ((clientY - rect.top) / rect.height) * 100,
    };
  }, []);

  const handleDesignDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isDragging.current = true;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const pt = toPercent(clientX, clientY);
      dragStart.current = { mx: pt.x, my: pt.y, ox: designX, oy: designY };
    },
    [toPercent, designX, designY]
  );

  const handleCornerDown = useCallback(
    (e: React.MouseEvent | React.TouchEvent) => {
      e.preventDefault();
      e.stopPropagation();
      isResizing.current = true;
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
      const pt = toPercent(clientX, clientY);
      resizeStart.current = { mx: pt.x, my: pt.y, ow: designW };
    },
    [toPercent, designW]
  );

  useEffect(() => {
    const onMove = (e: MouseEvent | TouchEvent) => {
      const clientX =
        "touches" in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
      const clientY =
        "touches" in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
      const pt = toPercent(clientX, clientY);

      if (isDragging.current) {
        setDesignX(dragStart.current.ox + (pt.x - dragStart.current.mx));
        setDesignY(dragStart.current.oy + (pt.y - dragStart.current.my));
      }

      if (isResizing.current) {
        const delta = pt.x - resizeStart.current.mx;
        const newW = Math.max(8, Math.min(70, resizeStart.current.ow + delta));
        setDesignW(newW);
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
  }, [toPercent]);

  const cornerSize = "8px";

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Garment type selector */}
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

      {/* Color selector */}
      <div className="flex items-center gap-2">
        {(["white", "gray", "black"] as GarmentColor[]).map((c) => (
          <button
            key={c}
            onClick={() => setGarmentColor(c)}
            className={`h-6 w-6 rounded-full border-2 transition-all ${
              garmentColor === c ? "border-accent scale-110" : "border-white/20"
            }`}
            style={{ backgroundColor: COLOR_SWATCHES[c] }}
            title={c}
          />
        ))}
      </div>

      {/* Garment with design overlay */}
      <div
        ref={containerRef}
        className="relative w-full max-w-sm select-none"
        style={{ maxHeight: "56vh" }}
      >
        {/* Garment photo */}
        <img
          src={garmentSrc}
          alt={`${garmentColor} ${garmentType}`}
          className="pointer-events-none mx-auto block h-auto w-full select-none object-contain"
          style={{
            filter:
              garmentColor === "black"
                ? `${garmentFilter} drop-shadow(0 0 18px rgba(255,255,255,0.12))`
                : garmentFilter,
            maxHeight: "56vh",
          }}
          draggable={false}
        />

        {/* Design overlay — masked to garment silhouette */}
        <div
          className="absolute inset-0"
          style={{
            WebkitMaskImage: `url(${garmentSrc})`,
            maskImage: `url(${garmentSrc})`,
            WebkitMaskSize: "contain",
            maskSize: "contain",
            WebkitMaskRepeat: "no-repeat",
            maskRepeat: "no-repeat",
            WebkitMaskPosition: "center",
            maskPosition: "center",
          }}
        >
          <img
            src={designImageUrl}
            alt="design"
            draggable={false}
            className="absolute select-none"
            style={{
              left: `${designX}%`,
              top: `${designY}%`,
              width: `${designW}%`,
              mixBlendMode: garmentColor === "black" ? "screen" : "multiply",
              opacity: 0.92,
              cursor: "move",
            }}
            onMouseDown={handleDesignDown}
            onTouchStart={handleDesignDown}
          />
        </div>

        {/* Bounding box */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${designX}%`,
            top: `${designY}%`,
            width: `${designW}%`,
            height: `${designH}%`,
            border: "1px dashed rgba(233, 115, 25, 0.5)",
            borderRadius: "2px",
          }}
        />

        {/* Corner handles */}
        {[
          { left: `${designX}%`, top: `${designY}%`, tx: "-50%", ty: "-50%" },
          {
            left: `${designX + designW}%`,
            top: `${designY}%`,
            tx: "-50%",
            ty: "-50%",
          },
          {
            left: `${designX}%`,
            top: `${designY + designH}%`,
            tx: "-50%",
            ty: "-50%",
          },
          {
            left: `${designX + designW}%`,
            top: `${designY + designH}%`,
            tx: "-50%",
            ty: "-50%",
          },
        ].map((pos, i) => (
          <div
            key={i}
            className="absolute rounded-sm"
            style={{
              left: pos.left,
              top: pos.top,
              width: cornerSize,
              height: cornerSize,
              transform: `translate(${pos.tx}, ${pos.ty})`,
              backgroundColor: "#e97319",
              border: "1px solid rgba(0,0,0,0.3)",
              cursor: "nwse-resize",
            }}
            onMouseDown={handleCornerDown}
            onTouchStart={handleCornerDown}
          />
        ))}
      </div>

      <p className="text-xs text-foreground/25">
        Drag to move · Drag corners to resize
      </p>
    </div>
  );
}
