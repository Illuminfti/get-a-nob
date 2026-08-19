import type { ErrorComponentProps } from "@tanstack/react-router";

export function AppErrorComponent({ error }: ErrorComponentProps) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-yellow px-6 text-center text-ink">
      <p className="font-display text-4xl leading-none" style={{ transform: "rotate(-2deg)" }}>
        Jammed.
      </p>
      <p className="max-w-md text-pretty text-base font-semibold leading-snug">
        {error.message || "The door jammed. Reload the page."}
      </p>
    </main>
  );
}
