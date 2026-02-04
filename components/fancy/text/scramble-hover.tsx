"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "./cn";

const DEFAULT_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

type Props = {
  text: string;
  className?: string;
  scrambleSpeed?: number;
  maxIterations?: number;
  useOriginalCharsOnly?: boolean;
};

export default function ScrambleHover({
  text,
  className,
  scrambleSpeed = 50,
  maxIterations = 8,
  useOriginalCharsOnly = true,
}: Props) {
  const [display, setDisplay] = useState(text);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    setDisplay(text);
  }, [text]);

  const getPool = () => {
    if (!useOriginalCharsOnly) return DEFAULT_POOL;
    const unique = Array.from(new Set(text.split(""))).filter((char) => char !== " ");
    return unique.length ? unique.join("") : DEFAULT_POOL;
  };

  const scramble = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
    }

    const pool = getPool();
    let iteration = 0;

    timerRef.current = window.setInterval(() => {
      const progress = iteration / maxIterations;
      const revealCount = Math.floor(progress * text.length);
      const next = text
        .split("")
        .map((char, index) => {
          if (char === " ") return " ";
          if (index < revealCount) return char;
          return pool[Math.floor(Math.random() * pool.length)];
        })
        .join("");

      setDisplay(next);
      iteration += 1;

      if (iteration > maxIterations) {
        if (timerRef.current) {
          window.clearInterval(timerRef.current);
        }
        timerRef.current = null;
        setDisplay(text);
      }
    }, scrambleSpeed);
  };

  const stop = () => {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setDisplay(text);
  };

  return (
    <span
      className={cn("scramble-hover", className)}
      onPointerEnter={scramble}
      onPointerLeave={stop}
    >
      {display}
    </span>
  );
}
