import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const APNS_KEY_ID = Deno.env.get("APNS_KEY_ID")!;
const APNS_TEAM_ID = Deno.env.get("APNS_TEAM_ID")!;
const APNS_PRIVATE_KEY = Deno.env.get("APNS_PRIVATE_KEY")!;
const APNS_BUNDLE_ID = Deno.env.get("APNS_BUNDLE_ID") ?? "com.alexandreamine.stampaway";
const APNS_HOST = "https://api.push.apple.com"; // production

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

// --- JWT for APNs (ES256) ---
let cachedJwt: { token: string; iat: number } | null = null;

function b64urlEncode(data: ArrayBuffer | Uint8Array | string): string {
  let bytes: Uint8Array;
  if (typeof data === "string") bytes = new TextEncoder().encode(data);
  else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
  else bytes = data;
  let str = btoa(String.fromCharCode(...bytes));
  return str.replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

function pemToBinaryDer(pem: string): Uint8Array {
  const b64 = pem
    .replace(/-----BEGIN [^-]+-----/g, "")
    .replace(/-----END [^-]+-----/g, "")
    .replace(/\s+/g, "");
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function getApnsJwt(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cachedJwt && now - cachedJwt.iat < 50 * 60) return cachedJwt.token;

  const header = { alg: "ES256", kid: APNS_KEY_ID, typ: "JWT" };
  const payload = { iss: APNS_TEAM_ID, iat: now };
  const signingInput = `${b64urlEncode(JSON.stringify(header))}.${b64urlEncode(JSON.stringify(payload))}`;

  const keyData = pemToBinaryDer(APNS_PRIVATE_KEY);
  const key = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  const token = `${signingInput}.${b64urlEncode(sig)}`;
  cachedJwt = { token, iat: now };
  return token;
}

// --- Notification text ---
async function getUsername(userId: string): Promise<string> {
  const { data } = await supabase
    .from("profiles")
    .select("username")
    .eq("user_id", userId)
    .maybeSingle();
  return data?.username ?? "Someone";
}

function buildAlert(type: string, actor: string, extra: any): { title: string; body: string } {
  switch (type) {
    case "follow":
      return { title: "New follower", body: `${actor} started following you` };
    case "follow_request":
      return { title: "Follow request", body: `${actor} wants to follow you` };
    case "review_like":
      return { title: "New like", body: `${actor} liked your review` };
    case "review_comment":
      return {
        title: `${actor} commented`,
        body: (extra?.comment_text ?? "").toString().slice(0, 140) || "New comment on your review",
      };
    case "list_like":
      return { title: "New like", body: `${actor} liked your list` };
    default:
      return { title: "StampAway", body: "You have a new notification" };
  }
}

async function sendOne(token: string, jwt: string, payload: object): Promise<{ ok: boolean; status: number; reason?: string }> {
  const res = await fetch(`${APNS_HOST}/3/device/${token}`, {
    method: "POST",
    headers: {
      authorization: `bearer ${jwt}`,
      "apns-topic": APNS_BUNDLE_ID,
      "apns-push-type": "alert",
      "apns-priority": "10",
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  if (res.ok) return { ok: true, status: res.status };
  let reason: string | undefined;
  try {
    const j = await res.json();
    reason = j?.reason;
  } catch (_) { /* ignore */ }
  return { ok: false, status: res.status, reason };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json();
    const { type, recipient_id, actor_id } = body ?? {};
    if (!type || !recipient_id) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400,
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const { data: tokens } = await supabase
      .from("device_tokens")
      .select("token")
      .eq("user_id", recipient_id);

    if (!tokens?.length) {
      return new Response(JSON.stringify({ ok: true, delivered: 0 }), {
        headers: { ...corsHeaders, "content-type": "application/json" },
      });
    }

    const actorName = actor_id ? await getUsername(actor_id) : "Someone";
    const alert = buildAlert(type, actorName, body);

    const apnsPayload = {
      aps: {
        alert: { title: alert.title, body: alert.body },
        sound: "default",
        badge: 1,
      },
      type,
      actor_id,
      ...body,
    };

    const jwt = await getApnsJwt();
    let delivered = 0;
    const toDelete: string[] = [];

    await Promise.all(
      tokens.map(async (t) => {
        const r = await sendOne(t.token, jwt, apnsPayload);
        if (r.ok) delivered++;
        else if (r.status === 410 || r.reason === "BadDeviceToken" || r.reason === "Unregistered") {
          toDelete.push(t.token);
        }
      }),
    );

    if (toDelete.length) {
      await supabase.from("device_tokens").delete().in("token", toDelete);
    }

    return new Response(JSON.stringify({ ok: true, delivered }), {
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e?.message ?? e) }), {
      status: 500,
      headers: { ...corsHeaders, "content-type": "application/json" },
    });
  }
});
