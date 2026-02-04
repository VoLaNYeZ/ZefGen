"use client";

import { useMemo, useState } from "react";
import { cn } from "./cn";
import {
  buildVariationSettings,
  getStaggerOrder,
  parseVariationSettings,
  sanitizeChar,
  splitChars,
  StaggerFrom,
  shuffle,
} from "./utils";

type Props = {
  label: string;
  staggerDuration?: number;
  className?: string;
  fromFontVariationSettings: string;
  toFontVariationSettings: string;
  staggerFrom?: StaggerFrom;
};

export default function VariableFontHoverByRandomLetter({
  label,
  staggerDuration = 0.03,
  className,
  fromFontVariationSettings,
  toFontVariationSettings,
  staggerFrom = "random",
}: Props) {
  const letters = useMemo(() => splitChars(label), [label]);
  const [hovered, setHovered] = useState(false);
  const [order, setOrder] = useState<number[]>(() =>
    getStaggerOrder(letters.length, staggerFrom)
  );

  const fromSettings = useMemo(
    () => parseVariationSettings(fromFontVariationSettings),
    [fromFontVariationSettings]
  );
  const toSettings = useMemo(
    () => parseVariationSettings(toFontVariationSettings),
    [toFontVariationSettings]
  );

  const handleEnter = () => {
    setOrder(shuffle(getStaggerOrder(letters.length, staggerFrom)));
    setHovered(true);
  };

  const handleLeave = () => {
    setOrder(shuffle(getStaggerOrder(letters.length, staggerFrom)));
    setHovered(false);
  };

  return (
    <span
      className={cn("vf-hover", className)}
      onPointerEnter={handleEnter}
      onPointerLeave={handleLeave}
    >
      {letters.map((char, index) => {
        const orderIndex = order.indexOf(index);
        const delay = (orderIndex < 0 ? 0 : orderIndex) * staggerDuration;
        const settings = hovered
          ? buildVariationSettings(toSettings.order, toSettings.axes)
          : buildVariationSettings(fromSettings.order, fromSettings.axes);

        return (
          <span
            key={`${char}-${index}`}
            style={{
              fontVariationSettings: settings,
              transition: "font-variation-settings 0.6s cubic-bezier(0.22, 1, 0.36, 1)",
              transitionDelay: `${delay}s`,
            }}
          >
            {sanitizeChar(char)}
          </span>
        );
      })}
    </span>
  );
}
