"use client";

import LetterSwapBase from "./letter-swap-base";
import { StaggerFrom } from "./utils";

type Props = {
  label: string;
  reverse?: boolean;
  staggerFrom?: StaggerFrom;
  staggerDuration?: number;
  className?: string;
};

export default function LetterSwapForward(props: Props) {
  return <LetterSwapBase {...props} mode="forward" />;
}
