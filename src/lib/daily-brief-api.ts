import { getToken } from "./api-client";

const API_BASE = import.meta.env.VITE_API_URL as string | undefined;

function normalizeApiBase(base: string) {
  const trimmed = base.replace(/\/+$/, "");
  return trimmed.endsWith("/api") ? trimmed : `${trimmed}/api`;
}

export type SummaryOut = {
  bestZone: string;
  weakZone: string;
  topPerformer: string;
  topBlocker: string;
  hotLeadRisk: string;
  priorities: string[];
  oneLineForLeadership: string;
};

export type DailyBriefResponse = {
  summary: SummaryOut | null;
  raw?: string;
  fallback?: boolean;
  error?: string;
};

export async function fetchDailyBrief(date?: string): Promise<DailyBriefResponse> {
  if (!API_BASE) {
    throw new Error("VITE_API_URL is not configured.");
  }

  const token = getToken();
  const finalUrl = `${normalizeApiBase(API_BASE)}/operator/daily-brief`;
  const isDev = import.meta.env.DEV;

  if (isDev) {
    console.log(`[daily-brief] generating...`);
    console.log(`[daily-brief] final request URL: ${finalUrl}`);
  }

  const res = await fetch(finalUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(date ? { date } : {}),
  });

  if (isDev) {
    console.log(`[daily-brief] response status: ${res.status}`);
  }

  const text = await res.text();
  if (!res.ok) {
    let errorMessage = `Request failed (${res.status})`;
    if (text) {
      try {
        const errorJson = JSON.parse(text);
        if (errorJson?.error) {
          errorMessage = String(errorJson.error);
        }
      } catch {
        if (!text.trim().startsWith("<")) {
          errorMessage = text;
        }
      }
    }
    if (isDev) {
      console.error(`[daily-brief] failure: ${errorMessage}`);
    }
    throw new Error(`Daily brief fetch failed (${res.status}): ${errorMessage}`);
  }

  let data: DailyBriefResponse;
  try {
    data = JSON.parse(text) as DailyBriefResponse;
  } catch (parseError) {
    if (isDev) {
      console.error(`[daily-brief] failure: invalid JSON response`, text);
    }
    throw new Error("Daily brief fetch failed: Invalid JSON response");
  }

  if (!data.summary) {
    const errorMessage = data.error ?? "Daily brief response missing summary";
    if (isDev) {
      console.error(`[daily-brief] failure: ${errorMessage}`);
    }
    throw new Error(`Daily brief fetch failed: ${errorMessage}`);
  }

  return data;
}
