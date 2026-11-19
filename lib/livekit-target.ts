import { createClient } from "@supabase/supabase-js";

// Which LiveKit server new classroom connections use (#950).
//
// The main server is the one in NEXT_PUBLIC_LIVEKIT_URL + LIVEKIT_API_KEY/SECRET
// (LiveKit Cloud today, the studio's own rtc.musicalbasics.com after the switch,
// docs/self-hosted-livekit.md). The fallback is LiveKit Cloud from
// LIVEKIT_CLOUD_URL + LIVEKIT_CLOUD_API_KEY/SECRET, which are only set at the
// switch. When the shared setting classroom_settings.livekit_fallback is true
// (flipped from the portal's server-down email) and the fallback is configured,
// tokens, recordings and room calls go to the fallback, with no redeploy. Before
// the switch there is no fallback, so the setting changes nothing.
//
// Webhooks from either server are accepted (allTargets).

export type LiveKitTarget = {
    name: "main" | "fallback";
    wsUrl: string;
    httpUrl: string;
    apiKey: string;
    apiSecret: string;
    /** Our own server (not *.livekit.cloud): piano camera and attendance only run there. */
    selfHosted: boolean;
};

const CACHE_MS = 30_000;
let cached: { at: number; fallback: boolean } | null = null;

function toHttp(url: string): string {
    // Server SDK clients need an http(s) URL, not the wss:// signalling URL.
    return url.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

export function isCloudUrl(url: string): boolean {
    try {
        const host = new URL(url).hostname.toLowerCase();
        return host === "livekit.cloud" || host.endsWith(".livekit.cloud");
    } catch {
        return true;
    }
}

function build(name: LiveKitTarget["name"], url?: string, key?: string, secret?: string): LiveKitTarget | null {
    if (!url || !key || !secret) return null;
    return { name, wsUrl: url, httpUrl: toHttp(url), apiKey: key, apiSecret: secret, selfHosted: !isCloudUrl(url) };
}

export function mainTarget(): LiveKitTarget | null {
    return build("main", process.env.NEXT_PUBLIC_LIVEKIT_URL, process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
}

export function fallbackTarget(): LiveKitTarget | null {
    return build("fallback", process.env.LIVEKIT_CLOUD_URL, process.env.LIVEKIT_CLOUD_API_KEY, process.env.LIVEKIT_CLOUD_API_SECRET);
}

/** Both servers, for verifying webhooks (an egress may finish on the one we just left). */
export function allTargets(): LiveKitTarget[] {
    return [mainTarget(), fallbackTarget()].filter((t): t is LiveKitTarget => !!t);
}

async function fallbackOn(): Promise<boolean> {
    if (cached && Date.now() - cached.at < CACHE_MS) return cached.fallback;
    let fallback = false;
    try {
        const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
        if (url && key) {
            const { data } = await createClient(url, key, { auth: { persistSession: false } })
                .from("classroom_settings")
                .select("value")
                .eq("key", "livekit_fallback")
                .maybeSingle();
            fallback = data?.value === true;
        }
    } catch (e) {
        // Unreadable setting: stay on the main server (the normal case).
        console.error("[livekit-target] could not read classroom_settings:", e);
    }
    cached = { at: Date.now(), fallback };
    return fallback;
}

/** The server new connections, tokens and recordings use right now. */
export async function activeTarget(): Promise<LiveKitTarget> {
    const main = mainTarget();
    const fallback = fallbackTarget();
    if (fallback && (await fallbackOn())) return fallback;
    if (!main) throw new Error("LiveKit credentials not configured");
    return main;
}

/** For tests: forget the cached setting. */
export function resetLiveKitTargetCache() {
    cached = null;
}
