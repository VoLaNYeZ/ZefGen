"use client";

import { useEffect, useMemo, useRef } from "react";
import { cn } from "./cn";
import {
  buildVariationSettings,
  lerp,
  parseVariationSettings,
  sanitizeChar,
  splitChars,
} from "./utils";

type Props = {
  children: string;
  className?: string;
  staggerDuration?: number;
  fromFontVariationSettings: string;
  toFontVariationSettings: string;
};

export default function BreathingText({
  children,
  className,
  staggerDuration = 0.08,
  fromFontVariationSettings,
  toFontVariationSettings,
}: Props) {
  const letters = useMemo(() => splitChars(children), [children]);
  const from = useMemo(
    () => parseVariationSettings(fromFontVariationSettings),
    [fromFontVariationSettings]
  );
  const to = useMemo(
    () => parseVariationSettings(toFontVariationSettings),
    [toFontVariationSettings]
  );

  const spansRef = useRef<HTMLSpanElement[]>([]);

  useEffect(() => {
    let frameId = 0;
    const start = performance.now();

    const tick = (time: number) => {
      const t = (time - start) / 1000;
      spansRef.current.forEach((span, index) => {
        const phase = t * 1.4 + index * staggerDuration * 6;
        const wave = (Math.sin(phase) + 1) / 2;
        const current: Record<string, number> = {};
        from.order.forEach((axis) => {
          current[axis] = lerp(from.axes[axis], to.axes[axis], wave);
        });
        span.style.fontVariationSettings = buildVariationSettings(from.order, current);
      });

      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);

    return () => cancelAnimationFrame(frameId);
  }, [from, to, staggerDuration]);

  return (
    <span className={cn("breathing-text", className)}>
      {letters.map((char, index) => (
        <span
          key={`${char}-${index}`}
          ref={(el) => {
            if (el) spansRef.current[index] = el;
          }}
        >
          {sanitizeChar(char)}
        </span>
      ))}
    </span>
  );
}
