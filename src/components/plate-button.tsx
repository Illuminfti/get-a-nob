import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type Tone = "blue" | "ink" | "paper" | "pink";

const tones: Record<Tone, string> = {
  blue: "bg-blue text-paper",
  ink: "bg-ink text-paper",
  paper: "bg-paper text-ink",
  pink: "bg-pink text-ink",
};

export function PlateButton({
  children,
  tone = "blue",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <button
      type="button"
      className={cn(
        "plate min-h-12 w-full px-5 py-3 text-base tracking-tight",
        tones[tone],
        "disabled:translate-y-0 disabled:opacity-55 disabled:shadow-[8px_8px_0_#17110b]",
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
