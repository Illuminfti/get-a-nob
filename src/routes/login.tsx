import { createFileRoute, Navigate } from "@tanstack/react-router";
import { authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { DieCut } from "@/components/die-cut";
import { PlateButton } from "@/components/plate-button";
import { useState } from "react";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isPending && user) {
    return <Navigate to="/" />;
  }

  async function connect() {
    setError(null);
    setBusy(true);
    try {
      await signIn("grok-x", { callbackURL: "/", errorCallbackURL: "/login" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "The door jammed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center px-5 py-10 pb-28 text-center">
      <p className="wordmark mb-8 text-ink">nob</p>
      <DieCut text="Connect to Twitter." className="text-[clamp(40px,10vw,72px)]" />
      <p className="mt-8 max-w-[28ch] text-pretty text-lg font-semibold leading-snug">
        Nob needs a face to judge. X is the door.
      </p>
      <div className="mt-10 w-full max-w-sm">
        {authEnabled ? (
          <PlateButton onClick={() => void connect()} disabled={busy}>
            {busy ? "Opening the door." : "Connect to Twitter"}
          </PlateButton>
        ) : (
          <p className="text-sm font-semibold">Sign-in is closed.</p>
        )}
        {error ? (
          <p className="mt-4 text-sm font-bold text-signal-red" role="alert">
            {error}
          </p>
        ) : null}
      </div>
    </main>
  );
}
