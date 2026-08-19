import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { authEnabled, signIn, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { DieCut } from "@/components/die-cut";
import { NobFace } from "@/components/nob-face";
import { PlateButton } from "@/components/plate-button";
import { generateNobPfp, getLatestPfp } from "@/lib/pfp";
import { changeTwitterPfp, shareNob } from "@/lib/share";

export const Route = createFileRoute("/")({ component: Home });

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error(message)), ms);
    promise.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        window.clearTimeout(timer);
        reject(err);
      },
    );
  });
}

function Home() {
  const { user, isPending } = useCurrentUserState();
  const [nobImage, setNobImage] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [statusBad, setStatusBad] = useState(false);

  useEffect(() => {
    if (!user) {
      setNobImage(null);
      setSourceUrl(null);
      return;
    }
    let cancelled = false;
    void getLatestPfp()
      .then((row) => {
        if (cancelled || !row) return;
        setNobImage(row.imageData);
        setSourceUrl(row.sourceUrl);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  async function connect() {
    setStatus(null);
    setStatusBad(false);
    setBusy(true);
    try {
      await signIn("grok-x", { callbackURL: "/", errorCallbackURL: "/" });
    } catch (err) {
      setStatusBad(true);
      setStatus(err instanceof Error ? err.message : "The door jammed.");
    } finally {
      setBusy(false);
    }
  }

  async function generate() {
    const photoUrl = user?.profileImageUrl ?? null;
    if (!photoUrl) {
      setStatusBad(true);
      setStatus("Nob needs a face. Put a photo on X first.");
      return;
    }
    setStatus("Nob is looking.");
    setStatusBad(false);
    setBusy(true);
    try {
      const result = await withTimeout(
        generateNobPfp({ data: { photoUrl } }),
        55_000,
        "Nob took too long.",
      );
      if (result.ok) {
        setNobImage(result.imageData);
        setSourceUrl(result.sourceUrl);
        setStatus("Approved. Take it to X.");
      } else {
        setStatusBad(true);
        setStatus(result.error);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "The door jammed.";
      setStatusBad(true);
      setStatus(message === "Unauthorized" ? "Connect to Twitter first." : message);
    } finally {
      setBusy(false);
    }
  }

  async function onShare() {
    if (!nobImage) return;
    setStatus(null);
    try {
      const mode = await shareNob(nobImage);
      setStatus(mode === "shared" ? "Shared." : "File saved. The tweet box is open.");
    } catch {
      setStatus("Share was cancelled.");
    }
  }

  async function onChangePfp() {
    if (!nobImage) return;
    setStatus(null);
    try {
      await changeTwitterPfp(nobImage);
      setStatus("File saved. X is open. Pick the file.");
    } catch {
      setStatus("Could not save the file.");
    }
  }

  const faceUrl = sourceUrl ?? user?.profileImageUrl ?? null;
  const showResult = Boolean(nobImage);
  const signedIn = Boolean(user);

  return (
    <main className="relative z-10 mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pb-28 pt-6 sm:px-8">
      <header className="flex items-start justify-between gap-4">
        <p className="wordmark text-ink" aria-label="nob">
          nob
        </p>
        <AuthChip isPending={isPending} name={user?.displayName ?? null} />
      </header>

      <section className="mt-10 flex flex-col items-center text-center sm:mt-14">
        <DieCut text="Get a Nob." className="text-[clamp(52px,14vw,108px)]" />
        <p className="mt-7 max-w-[26ch] text-pretty text-lg font-semibold leading-snug sm:text-xl">
          A tiny, judgmental doorman for your face.
        </p>

        <div className="mt-10 w-full sm:mt-12">
          <PortraitStage
            faceUrl={faceUrl}
            nobImage={nobImage}
            busy={busy && signedIn}
          />
        </div>

        <div className="mt-10 flex w-full max-w-sm flex-col gap-3">
          {!signedIn ? (
            authEnabled ? (
              <PlateButton onClick={() => void connect()} disabled={busy}>
                {busy ? "Opening the door." : "Connect to Twitter"}
              </PlateButton>
            ) : (
              <p className="text-sm font-semibold">Sign-in is closed.</p>
            )
          ) : !showResult ? (
            <PlateButton onClick={() => void generate()} disabled={busy}>
              {busy ? "Working the door." : "Generate"}
            </PlateButton>
          ) : (
            <>
              <PlateButton onClick={() => void onChangePfp()} disabled={busy}>
                Change to your Twitter PFP
              </PlateButton>
              <PlateButton tone="paper" onClick={() => void onShare()} disabled={busy}>
                Share
              </PlateButton>
              <PlateButton tone="ink" onClick={() => void generate()} disabled={busy}>
                {busy ? "Working the door." : "Generate again"}
              </PlateButton>
            </>
          )}
        </div>

        <p
          className={`mt-5 min-h-6 max-w-[34ch] text-pretty text-sm font-bold leading-snug ${statusBad ? "text-signal-red" : "text-ink"}`}
          role="status"
        >
          {status ??
            (signedIn && !faceUrl
              ? "Nob needs a face. Put a photo on X first."
              : !signedIn
                ? "Press Nob. Then open the door."
                : "\u00a0")}
        </p>
      </section>

      <footer className="mt-8 pb-4 text-center">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-ink/70">
          Morning, big nob.
        </p>
      </footer>
    </main>
  );
}

function AuthChip({
  isPending,
  name,
}: {
  isPending: boolean;
  name: string | null;
}) {
  if (isPending) {
    return <div className="h-8 w-24 bg-ink/10" aria-hidden="true" />;
  }
  if (!name) return <span className="h-8" />;
  return (
    <div className="flex items-center gap-3 pt-1">
      <span className="max-w-[12ch] truncate text-xs font-extrabold uppercase tracking-[0.12em]">
        {name}
      </span>
      <button
        type="button"
        onClick={() => void signOut("/")}
        className="text-xs font-extrabold uppercase tracking-[0.12em] underline decoration-2 underline-offset-4"
      >
        Sign out
      </button>
    </div>
  );
}

function PortraitStage({
  faceUrl,
  nobImage,
  busy,
}: {
  faceUrl: string | null;
  nobImage: string | null;
  busy: boolean;
}) {
  if (nobImage) {
    return (
      <div className="mx-auto flex w-full max-w-md items-center justify-center gap-3 sm:gap-5">
        {faceUrl ? <FacePlate src={faceUrl} alt="Your current face" small /> : null}
        {faceUrl ? <Arrow /> : null}
        <div className="relative">
          <FacePlate src={nobImage} alt="Your Nob" />
          {busy ? <WorkingStamp /> : <ApprovedStamp />}
        </div>
      </div>
    );
  }

  return (
    <div className="relative mx-auto w-[min(100%,320px)]">
      <NobFace busy={busy} />
      {busy ? <WorkingStamp /> : null}
    </div>
  );
}

function FacePlate({
  src,
  alt,
  small = false,
}: {
  src: string;
  alt: string;
  small?: boolean;
}) {
  return (
    <img
      src={src}
      alt={alt}
      className={
        small
          ? "portrait-plate h-24 w-24 object-cover sm:h-28 sm:w-28"
          : "portrait-plate h-40 w-40 object-cover sm:h-52 sm:w-52"
      }
      draggable={false}
    />
  );
}

function Arrow() {
  return (
    <svg
      viewBox="0 0 48 24"
      className="h-6 w-10 shrink-0 sm:h-7 sm:w-12"
      aria-hidden="true"
    >
      <path
        d="M2 12 H38 M30 4 L42 12 L30 20"
        fill="none"
        stroke="#17110b"
        strokeWidth="3.2"
        strokeLinecap="square"
        strokeLinejoin="miter"
      />
    </svg>
  );
}

function WorkingStamp() {
  return (
    <div
      className="stamp pointer-events-none absolute left-1/2 top-1/2 z-10 -translate-x-1/2 -translate-y-1/2 px-3 py-2 text-xs sm:text-sm"
      aria-live="polite"
    >
      Working the door
    </div>
  );
}

function ApprovedStamp() {
  return (
    <div className="stamp pointer-events-none absolute -right-2 -top-3 z-10 px-2 py-1 text-[10px] sm:text-xs">
      Nob
    </div>
  );
}
