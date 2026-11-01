// Supabase Edge Function: AI character art for Chart Doodle Oracle.
//
// POST /functions/v1/chart-doodle-art
//   { char, dir, sig: number[48], line: "data:image/png;base64,..." }
//
// 1. Looks for previously generated art of the same character whose shape signature
//    (chart + forecast path, 48 samples in 0..1) is close enough; if found, reuses it.
// 2. Otherwise generates new art through the BAZE image API from the line sketch,
//    stores it in Storage (bucket "doodle-art") with its signature, and returns it.
//
// Secrets: BAZE_API_KEY (required). Optional: BAZE_IMAGE_MODEL, DOODLE_IP_DAILY_LIMIT, DOODLE_GLOBAL_DAILY_LIMIT, DOODLE_MATCH_RMS.
// Deploy:  supabase functions deploy chart-doodle-art --no-verify-jwt

import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
};
const SIG_LEN = 48;
const MODEL = Deno.env.get("BAZE_IMAGE_MODEL") ?? "gemini-3.1-flash-lite-image";
const IP_LIMIT = +(Deno.env.get("DOODLE_IP_DAILY_LIMIT") ?? 20);
const GLOBAL_LIMIT = +(Deno.env.get("DOODLE_GLOBAL_DAILY_LIMIT") ?? 150);
// Reuse when the root-mean-square gap between shapes is under this (fraction of chart height).
const MATCH_RMS = +(Deno.env.get("DOODLE_MATCH_RMS") ?? 0.09);

const SUBJECT: Record<string, [string, string]> = {
  cat: ["a cat", "the two highest bumps of the curve are the cat's two pointy ears and the cat's round face hangs right below and between them"],
  camel: ["a camel", "the two big bumps of the curve are the camel's humps; give it legs below and a head and neck at the right end"],
  whale: ["a whale", "the long curve is the whale's back, with its belly below it, and the line rising at the right end is its tail with flukes"],
  shark: ["a shark", "the sharp peak is the shark's dorsal fin sticking out of the water, with waves along its base"],
  dino: ["a long-necked dinosaur", "the line rising at the right end is the dinosaur's long neck with its head at the top; its big body sits below the middle of the curve"],
  snail: ["a snail", "the flat right part of the curve is the ground the snail crawls on, with its spiral shell sitting on the curve"],
  rabbit: ["a rabbit", "the two tall spikes on the right are the rabbit's two long ears and its face is right below them"],
  snake: ["a snake", "the whole wiggly curve is the snake's body and its head with a forked tongue is at the right end"],
  ghost: ["a ghost", "the peak of the curve is the round top of the ghost's head, with a wavy bottom, and the line falling to the right is the ghost fading away"],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

async function sha(s: string) {
  const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s + "|chart-doodle"));
  return [...new Uint8Array(b)].slice(0, 12).map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  if (req.method !== "POST") return json({ error: "Use POST." }, 405);

  let body: { char?: string; dir?: number; sig?: number[]; line?: string; reuseOnly?: boolean };
  try { body = await req.json(); } catch { return json({ error: "Body must be JSON." }, 400); }
  const { char = "", dir = 0, sig, line, reuseOnly } = body;
  if (!SUBJECT[char]) return json({ error: "Unknown character." }, 400);
  if (!Array.isArray(sig) || sig.length !== SIG_LEN || sig.some((v) => typeof v !== "number" || !isFinite(v) || v < -1 || v > 2)) {
    return json({ error: `sig must be ${SIG_LEN} numbers.` }, 400);
  }

  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const publicUrl = (path: string) => sb.storage.from("doodle-art").getPublicUrl(path).data.publicUrl;
  const vec = `[${sig.map((v) => v.toFixed(4)).join(",")}]`;

  // 1) reuse
  const { data: hit, error: mErr } = await sb.rpc("match_doodle_art", { p_char: char, p_sig: vec });
  if (mErr) return json({ error: `Lookup failed: ${mErr.message}` }, 500);
  const best = hit?.[0];
  const rms = best ? best.distance / Math.sqrt(SIG_LEN) : Infinity;
  if (best && rms <= MATCH_RMS) {
    sb.rpc("doodle_art_hit", { p_id: best.id }).then(() => {}, () => {});
    return json({ url: publicUrl(best.image_path), reused: true, similarity: Math.max(0, 1 - rms * 4) });
  }
  if (reuseOnly) return json({ reused: false, miss: true });

  // 2) generate
  const key = Deno.env.get("BAZE_API_KEY");
  if (!key) return json({ error: "BAZE_API_KEY is not set on this Supabase project." }, 503);
  if (typeof line !== "string" || !line.startsWith("data:image/png;base64,") || line.length > 3_000_000) {
    return json({ error: "line must be a PNG data URL under 2MB." }, 400);
  }
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "unknown";
  const { data: ok, error: lErr } = await sb.rpc("doodle_try_generate", { p_ip: await sha(ip), p_ip_limit: IP_LIMIT, p_global_limit: GLOBAL_LIMIT });
  if (lErr) return json({ error: `Limit check failed: ${lErr.message}` }, 500);
  if (!ok) return json({ error: "Daily drawing limit reached.", limited: true }, 429);

  const [subject, layout] = SUBJECT[char];
  const prompt =
    `This image is a black curve on a white canvas. Turn it into a funny, crude, hand-drawn doodle of ${subject}: ${layout}. ` +
    `Keep the black curve exactly where it is, at the same size and position, and draw the rest of the picture around it. ` +
    `Thick marker strokes, a few flat colors, childish MS Paint style, plain white background, no text, no frame, no axes.`;

  let r: Response;
  try {
    r = await fetch("https://api.baze.co/v1/gateway/images/generate/", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "User-Agent": "chart-doodle/1.0" },
      body: JSON.stringify({ model: MODEL, prompt, aspect_ratio: "4:3", input_images: [line] }),
      signal: AbortSignal.timeout(90_000),
    });
  } catch (e) {
    return json({ error: `Image service did not answer: ${(e as Error).message}` }, 504);
  }
  const out = await r.json().catch(() => ({}));
  const url: string | undefined = out?.data?.[0]?.url;
  if (!r.ok || !url) return json({ error: `Image service failed (${r.status}).`, detail: out?.detail ?? out?.error ?? null }, 502);

  let bytes: Uint8Array, type = "image/png";
  if (url.startsWith("data:")) {
    const [head, b64] = url.split(",", 2);
    type = head.slice(5).split(";")[0] || type;
    bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  } else {
    const img = await fetch(url);
    type = img.headers.get("content-type") ?? type;
    bytes = new Uint8Array(await img.arrayBuffer());
  }
  const ext = type.includes("jpeg") ? "jpg" : type.includes("webp") ? "webp" : "png";
  const path = `${char}/${crypto.randomUUID()}.${ext}`;
  const { error: uErr } = await sb.storage.from("doodle-art").upload(path, bytes, { contentType: type, cacheControl: "31536000" });
  if (uErr) return json({ error: `Saving the image failed: ${uErr.message}` }, 500);
  const { error: iErr } = await sb.from("doodle_art").insert({ char, dir: Math.sign(dir), sig: vec, image_path: path, model: MODEL });
  if (iErr) return json({ error: `Saving the record failed: ${iErr.message}` }, 500);

  return json({ url: publicUrl(path), reused: false });
});
