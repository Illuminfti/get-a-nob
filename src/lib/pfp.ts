import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

const IMAGINE_MODEL = "grok-imagine-image-2.0";
const COOLDOWN_MS = 12_000;
const MAX_STORED = 6;

const NOB_PROMPT = `Transform the person's photograph into a Nob profile picture.

Nob is a bald, stippled, heavy-browed doorman mascot. Locked physical description:
- Entire head is signal-orange (#ff7c18) with spray-stipple shading and rough displaced ink, like a distressed comic-studio raster print on paper
- Thick asymmetric slab eyebrows in warm dark ink
- Large half-lidded tired eyes; sclera is aged paper cream (#f3e7c6), never pure white
- Small dusty-rose pink dot nose (#e98da3), not a clown ball
- Off-center deadpan mouth, small ears
- NO cap, NO hat, NO hair, NO beanie
- Hard offset dark drop shadow to the bottom-right with zero blur

The first image is the person. Preserve their recognizable likeness: bone structure, eye spacing, glasses if present, facial hair translated into ink texture on orange skin. Map their expression onto Nob's deadpan, unimpressed face.

A second image, if present, is the official Nob mascot. Match that print style, stipple, proportions, and ink exactly.

Square 1:1 profile picture. Head fills the frame. Warm cream paper background. Painted timber, stamped paperwork, blunt ink. Not 3D, not glossy, not cute cartoon polish, no new objects, no camera tilt.`;

type PfpRow = {
  id: number;
  image_data: string;
  source_url: string | null;
  created_at: string;
};

type GenerateResult =
  | { ok: true; imageData: string; sourceUrl: string | null }
  | { ok: false; error: string };

function upgradeProfileImage(url: string): string {
  return url.replace(
    /_(normal|bigger|mini|200x200|400x400)(\.[a-z0-9]+)(\?.*)?$/i,
    "_400x400$2$3",
  );
}

async function fetchAsDataUri(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      Accept: "image/*,*/*",
      "User-Agent": "NobPfp/1.0 (Grok Imagine)",
    },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    throw new Error(`Could not read the face (${res.status}).`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 32) {
    throw new Error("That photo is empty.");
  }
  if (buf.byteLength > 8_000_000) {
    throw new Error("That photo is too heavy.");
  }
  const mime = (res.headers.get("content-type") ?? "image/jpeg").split(";")[0]?.trim() || "image/jpeg";
  const safeMime = mime.startsWith("image/") ? mime : "image/jpeg";
  return `data:${safeMime};base64,${buf.toString("base64")}`;
}

type ImagineResponse = {
  data?: Array<{ url?: string; b64_json?: string }>;
  url?: string;
  error?: { message?: string };
};

async function imagineEdit(prompt: string, images: string[]): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    throw new Error("Imagine is closed.");
  }

  const imagePayload =
    images.length === 1
      ? { url: images[0], type: "image_url" }
      : images.map((url) => ({ url, type: "image_url" }));

  const body = {
    model: IMAGINE_MODEL,
    prompt,
    image: imagePayload,
    aspect_ratio: "1:1",
    resolution: "1k",
    n: 1,
    response_format: "b64_json",
  };

  const res = await fetch("https://api.x.ai/v1/images/edits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(110_000),
  });

  const raw = (await res.json().catch(() => ({}))) as ImagineResponse;
  if (!res.ok) {
    const message = raw.error?.message ?? `Imagine returned ${res.status}.`;
    throw new Error(message);
  }

  const b64 = raw.data?.[0]?.b64_json;
  if (b64) return `data:image/jpeg;base64,${b64}`;

  const url = raw.data?.[0]?.url ?? raw.url;
  if (url) return fetchAsDataUri(url);

  throw new Error("Imagine sent back an empty plate.");
}

async function imagineEditWithFallback(userPhoto: string): Promise<string> {
  const refs = [userPhoto];
  try {
    const mod = await import("@/assets/nob-style-ref.jpg?inline");
    const style = (mod as { default?: string }).default;
    if (typeof style === "string" && style.startsWith("data:")) {
      refs.push(style);
    }
  } catch {
    /* style reference is optional */
  }
  try {
    return await imagineEdit(NOB_PROMPT, refs);
  } catch (first) {
    if (refs.length === 1) throw first;
    return imagineEdit(NOB_PROMPT, [userPhoto]);
  }
}

export const getLatestPfp = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<{ imageData: string; sourceUrl: string | null } | null> => {
    const sql = await getSql();
    const rows = await sql<PfpRow>`
      select id, image_data, source_url, created_at
      from pfps
      where user_id = ${context.userId}
      order by created_at desc
      limit 1
    `;
    const row = rows[0];
    if (!row) return null;
    return { imageData: row.image_data, sourceUrl: row.source_url };
  });

export const generateNobPfp = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }): Promise<GenerateResult> => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) {
      return { ok: false, error: "Imagine is closed." };
    }

    const sql = await getSql();

    const recent = await sql<{ created_at: string }>`
      select created_at from pfps
      where user_id = ${context.userId}
      order by created_at desc
      limit 1
    `;
    if (recent[0]) {
      const then = new Date(recent[0].created_at).getTime();
      if (Number.isFinite(then) && Date.now() - then < COOLDOWN_MS) {
        return { ok: false, error: "Nob is still looking. Wait a beat." };
      }
    }

    const users = await sql<{ image: string | null; name: string }>`
      select image, name from "user" where id = ${context.userId} limit 1
    `;
    const sourceUrl = users[0]?.image ?? null;
    if (!sourceUrl) {
      return { ok: false, error: "Nob needs a face. Put a photo on X first." };
    }

    try {
      const photo = await fetchAsDataUri(upgradeProfileImage(sourceUrl));
      const imageData = await imagineEditWithFallback(photo);

      await sql`
        insert into pfps (user_id, source_url, image_data)
        values (${context.userId}, ${sourceUrl}, ${imageData})
      `;

      const extras = await sql<{ id: number }>`
        select id from pfps
        where user_id = ${context.userId}
        order by created_at desc
        offset ${MAX_STORED}
      `;
      for (const extra of extras) {
        await sql`delete from pfps where id = ${extra.id} and user_id = ${context.userId}`;
      }

      return { ok: true, imageData, sourceUrl };
    } catch (err) {
      const message = err instanceof Error ? err.message : "The door jammed.";
      return { ok: false, error: message };
    }
  });
