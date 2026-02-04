"use client";

import { useEffect, useMemo, useRef, type RefObject } from "react";
import { cn } from "./cn";
import {
  buildVariationSettings,
  lerp,
  parseVariationSettings,
  sanitizeChar,
  splitChars,
} from "./utils";
import { useMousePositionRef } from "./use-mouse-position-ref";

type Falloff = "linear" | "exponential" | "gaussian";

type Props = {
  label?: string;
  children?: string;
  className?: string;
  fromFontVariationSettings: string;
  toFontVariationSettings: string;
  radius?: number;
  falloff?: Falloff;
  containerRef: RefObject<HTMLElement>;
};

export default function VariableFontCursorProximity({
  label,
  children,
  className,
  fromFontVariationSettings,
  toFontVariationSettings,
  radius = 200,
  falloff = "linear",
  containerRef,
}: Props) {
  const text = label ?? children ?? "";
  const letters = useMemo(() => splitChars(text), [text]);
  const from = useMemo(
    () => parseVariationSettings(fromFontVariationSettings),
    [fromFontVariationSettings]
  );
  const to = useMemo(
    () => parseVariationSettings(toFontVariationSettings),
    [toFontVariationSettings]
  );

  const spansRef = useRef<HTMLSpanElement[]>([]);
  const pointerRef = useMousePositionRef(containerRef);

  const computeStrength = (distance: number) => {
    if (distance > radius) return 0;
    const t = 1 - distance / radius;
    if (falloff === "exponential") return t * t;
    if (falloff === "gaussian") {
      const g = distance / radius;
      return Math.exp(-(g * g));
    }
    return t;
  };

  useEffect(() => {
    let frameId = 0;
    const tick = () => {
      const container = containerRef.current;
      if (!container) {
        frameId = requestAnimationFrame(tick);
        return;
      }

      const containerRect = container.getBoundingClientRect();
      spansRef.current.forEach((span) => {
        if (!span) return;
        const rect = span.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2 - containerRect.left;
        const centerY = rect.top + rect.height / 2 - containerRect.top;
        const distance = Math.hypot(
          centerX - pointerRef.current.x,
          centerY - pointerRef.current.y
        );
        const strength = computeStrength(distance);

        const current: Record<string, number> = {};
        from.order.forEach((axis) => {
          current[axis] = lerp(from.axes[axis], to.axes[axis], strength);
        });

        span.style.fontVariationSettings = buildVariationSettings(from.order, current);
      });

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frameId);
    };
  }, [from, to, radius, falloff, containerRef, pointerRef]);

  return (
    <span className={cn("vf-cursor", className)}>
      {letters.map((char, index) => (
        <span
          key={`${char}-${index}`}
          ref={(el) => {
            if (el) spansRef.current[index] = el;
          }}
          style={{
            fontVariationSettings: buildVariationSettings(
              from.order,
              from.axes
            ),
          }}
        >
          {sanitizeChar(char)}
        </span>
      ))}
    </span>
  );
}
