"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { cn } from "./cn";
import {
  getStaggerOrder,
  sanitizeChar,
  splitChars,
  shuffle,
  StaggerFrom,
} from "./utils";

const LETTER_POOL = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

const pickRandomChar = () =>
  LETTER_POOL[Math.floor(Math.random() * LETTER_POOL.length)];

type LetterSwapProps = {
  label: string;
  reverse?: boolean;
  staggerFrom?: StaggerFrom;
  staggerDuration?: number;
  className?: string;
  mode: "forward" | "pingpong";
  randomSwap?: boolean;
};

export default function LetterSwapBase({
  label,
  reverse = false,
  staggerFrom = "first",
  staggerDuration = 0.03,
  className,
  mode,
  randomSwap = false,
}: LetterSwapProps) {
  const letters = useMemo(() => splitChars(label), [label]);
  const [hovered, setHovered] = useState(false);
  const [delays, setDelays] = useState<number[]>(() =>
    letters.map(() => 0)
  );
  const [swapChars, setSwapChars] = useState<string[]>(letters);
  const timeoutRef = useRef<number | null>(null);
  const duration = 0.6;

  useEffect(() => {
    setSwapChars(letters);
    setDelays(letters.map(() => 0));
  }, [letters]);

  const prepare = () => {
    const order = getStaggerOrder(letters.length, staggerFrom);
    const staggerOrder = randomSwap ? shuffle(order) : order;
    const nextDelays = letters.map(() => 0);
    staggerOrder.forEach((index, orderIndex) => {
      nextDelays[index] = orderIndex * staggerDuration;
    });
    setDelays(nextDelays);

    if (randomSwap) {
      setSwapChars(letters.map(() => pickRandomChar()));
    } else {
      setSwapChars(letters);
    }
  };

  const clearTimer = () => {
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  };

  const handleEnter = () => {
    clearTimer();
    prepare();
    setHovered(true);

    if (mode === "forward") {
      const maxDelay = Math.max(0, (letters.length - 1) * staggerDuration);
      const total = (maxDelay + duration + 0.05) * 1000;
      timeoutRef.current = window.setTimeout(() => {
        setHovered(false);
        setSwapChars(letters);
      }, total);
    }
  };

  const handleLeave = () => {
    if (mode === "pingpong") {
      clearTimer();
      setHovered(false);
      setSwapChars(letters);
    }
  };

  return (
    <span
      className={cn(
        "ls-root",
        reverse && "ls-reverse",
        hovered && "is-hovered",
        className
      )}
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
    >
      {letters.map((char, index) => (
        <span key={`${char}-${index}`} className="ls-char">
          <span className="ls-ghost">{sanitizeChar(char)}</span>
          <span
            className="ls-top"
            style={{ transitionDelay: `${delays[index] ?? 0}s` }}
          >
            {sanitizeChar(char)}
          </span>
          <span
            className="ls-bottom"
            style={{ transitionDelay: `${delays[index] ?? 0}s` }}
          >
            {sanitizeChar(swapChars[index] ?? char)}
          </span>
        </span>
      ))}
    </span>
  );
}
