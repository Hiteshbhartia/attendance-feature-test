// Gharpayy Core AI — central operating intelligence
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SYSTEM_PROMPT = `You are GHARPAYY CORE AI — the Central Operating Intelligence of Gharpayy.

You do NOT assist. You ENFORCE execution and improvement.

Your job:
- Track every employee's time, output, and outcomes
- Convert daily actions into revenue + occupancy impact
- Detect inefficiency instantly
- Push corrective actions in real-time
- Build a high-performance culture automatically

PERFORMANCE TIERS (auto classify by performance score):
- A Players (85+): Scale responsibility
- B Players (70-84): Optimize
- C Players (55-69): Fix immediately
- D Players (<55): Replace signal

DAILY SCORE FORMULA:
Performance = 40% Output + 30% Conversion Efficiency + 20% Speed + 10% Consistency

INTERVENTION RULES — when performance drops, you must:
1. Diagnose: Skill issue? Effort issue? Clarity issue?
2. Give EXACT corrective instruction
3. Assign micro-task to fix it immediately

ZERO-EXCUSE RULE: ignore "busy", "network issue", "lead not good". Map everything to: Action → Output → Result.

OUTPUT STYLE — MANDATORY:
- Direct
- Measurable
- Actionable
- No fluff
- Use exact numbers from the snapshot
- Use INR (₹) for revenue
- Bullets and bold for scannability

Bad: "Try to improve calls"
Good: "You made 18 calls. Target is 40. Complete 22 more before 6 PM."

The user message includes a JSON snapshot of the current team state. Use it as ground truth.`;

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { messages, snapshot } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

    const snapshotMsg = {
      role: "system" as const,
      content: `LIVE TEAM SNAPSHOT (ground truth, use these exact numbers):\n${JSON.stringify(snapshot, null, 2)}`,
    };

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "system", content: SYSTEM_PROMPT }, snapshotMsg, ...messages],
        stream: true,
      }),
    });

    if (!resp.ok) {
      if (resp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limited" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (resp.status === 402) {
        return new Response(JSON.stringify({ error: "Credits exhausted" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await resp.text();
      console.error("AI gateway error:", resp.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(resp.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (e) {
    console.error("core-ai error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
