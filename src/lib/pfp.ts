import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";

const IMAGINE_MODEL = "grok-imagine-image-2.0";
const COOLDOWN_MS = 8_000;
const MAX_STORED = 6;
const NOB_STYLE_URL =
  "https://nob-brand-book.vercel.app/assets/nob-mascot-reference-master.png";

const NOB_PROMPT = `Transform this photograph into a Nob profile picture.

Nob is a bald, stippled, heavy-browed doorman mascot:
- Entire head is signal-orange (#ff7c18) with spray-stipple shading and rough displaced ink
- Thick asymmetric slab eyebrows in warm dark ink
- Large half-lidded tired eyes; sclera is aged paper cream (#f3e7c6), never pure white
- Small dusty-rose pink dot nose (#e98da3)
- Off-center deadpan mouth, small ears
- NO cap, NO hat, NO hair, NO beanie
- Hard offset dark drop shadow to the bottom-right, zero blur

Keep this person's recognizable likeness: bone structure, eye spacing, glasses if present, facial hair as ink texture on orange skin.

Square 1:1 profile picture. Head fills the frame. Warm cream paper background. Painted timber, stamped paperwork, blunt ink. Not 3D, not glossy, no new objects.`;

const DUAL_PROMPT = `Transform the person in the first image into a Nob profile picture. The second image is the locked Nob mascot style. Match that style exactly.

${NOB_PROMPT}`;

type PfpRow = {
  id: number;
  image_data: string;
  source_url: string | null;
  created_at: string;
};

export type GenerateResult =
  | { ok: true; imageData: string; sourceUrl: string | null }
  | { ok: false; error: string };

type ImagineResponse = {
  data?: Array<{ url?: string; b64_json?: string }>;
  url?: string;
  error?: { message?: string };
};

function bestPhotoUrl(url: string): string {
  return url.replace(
    /_(normal|bigger|mini|200x200)(\.[a-z0-9]+)(\?.*)?$/i,
    "_400x400$2$3",
  );
}

async function imagineWith(image: unknown, timeoutMs: number, prompt = NOB_PROMPT): Promise<string> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) throw new Error("Imagine is closed.");

  const res = await fetch("https://api.x.ai/v1/images/edits", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: IMAGINE_MODEL,
      prompt: NOB_PROMPT,
      image,
      aspect_ratio: "1:1",
      n: 1,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  const raw = (await res.json().catch(() => ({}))) as ImagineResponse;
  if (!res.ok) {
    throw new Error(raw.error?.message ?? `Imagine returned ${res.status}.`);
  }

  const b64 = raw.data?.[0]?.b64_json;
  if (b64) return `data:image/jpeg;base64,${b64}`;

  const url = raw.data?.[0]?.url ?? raw.url;
  if (url) return url;

  throw new Error("Imagine sent back an empty plate.");
}

async function fetchAsDataUri(url: string): Promise<string> {
  const res = await fetch(url, {
    redirect: "follow",
    headers: {
      Accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      "User-Agent":
        "Mozilla/5.0 (compatible; NobPfp/1.0; +https://x.com/)",
      Referer: "https://x.com/",
    },
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Could not read the face (${res.status}).`);
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.byteLength < 32) throw new Error("That photo is empty.");
  if (buf.byteLength > 8_000_000) throw new Error("That photo is too heavy.");
  const mime =
    (res.headers.get("content-type") ?? "image/jpeg").split(";")[0]?.trim() ||
    "image/jpeg";
  const safeMime = mime.startsWith("image/") ? mime : "image/jpeg";
  return `data:${safeMime};base64,${buf.toString("base64")}`;
}

async function imagineEdit(photoUrl: string): Promise<string> {
  const photo = bestPhotoUrl(photoUrl);
  try {
    return await imagineWith([photo, NOB_STYLE_URL], 40_000, DUAL_PROMPT);
  } catch {
    // Single-image object shape is the documented fallback.
  }

  try {
    return await imagineWith({ url: photo, type: "image_url" }, 40_000);
  } catch {
    // Last resort: we fetch the photo and hand Imagine a data URI.
  }

  const dataUri = await fetchAsDataUri(photo);
  return await imagineWith({ url: dataUri, type: "image_url" }, 40_000);
}

async function persistable(image: string): Promise<string> {
  if (image.startsWith("data:")) return image;
  try {
    return await fetchAsDataUri(image);
  } catch {
    return image;
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
  .validator((input: { photoUrl?: string | null } | undefined) => ({
    photoUrl:
      typeof input?.photoUrl === "string" && input.photoUrl.startsWith("http")
        ? input.photoUrl
        : null,
  }))
  .middleware([authMiddleware])
  .handler(async ({ context, data }): Promise<GenerateResult> => {
    if (!process.env.XAI_API_KEY) {
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
        const last = await sql<PfpRow>`
          select id, image_data, source_url, created_at from pfps
          where user_id = ${context.userId}
          order by created_at desc limit 1
        `;
        if (last[0]) {
          return {
            ok: true,
            imageData: last[0].image_data,
            sourceUrl: last[0].source_url,
          };
        }
      }
    }

    const users = await sql<{ image: string | null; name: string }>`
      select image, name from "user" where id = ${context.userId} limit 1
    `;
    const sourceUrl = data.photoUrl ?? users[0]?.image ?? null;
    if (!sourceUrl) {
      return { ok: false, error: "Nob needs a face. Put a photo on X first." };
    }

    try {
      const rendered = await imagineEdit(sourceUrl);
      const imageData = await persistable(rendered);

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
