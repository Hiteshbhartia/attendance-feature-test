import { Router } from "express";
import Groq from "groq-sdk";
import { requireAuth } from "../middleware/auth.js";

const router = Router();
// We instantiate the client lazily to ensure process.env.GROQ_API_KEY is loaded by dotenv first.
let ai = null;

router.post("/priorities", requireAuth, async (req, res) => {
  try {
    const { actor, myTasks, assignedTasks, events, pulses, currentTime, timeSlot } = req.body;

    if (!actor) {
      return res.status(400).json({ error: "Missing actor context" });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: "GROQ_API_KEY is not configured on the server." });
    }

    if (!ai) {
      ai = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }

    const systemPrompt = `
      You are an elite operational AI assistant for the Gharpayy organization.
      Your job is to read the user's current context (tasks, events, role) and synthesize their "Mission Brief" — a prioritized list of what demands their attention right now.

      USER CONTEXT:
      - Name: ${actor?.name || "Unknown"}
      - Role: ${actor?.role || "Unknown"}
      - Team: ${actor?.team || "Unknown"}
      - Tier: ${actor?.tier || "Employee"}

      RULES FOR GENERATING PRIORITIES:
      1. Always return EXACTLY 3 priority items.
      2. If the user's Role is "Admin", DO NOT give them actual work tasks. An Admin only monitors the system, checks on what others are doing, and reviews high-level updates. Their priorities should reflect monitoring, reviewing reports, or checking system status.
      3. For other roles, deduce what a person in that Role/Team would be doing based on typical software/business operations.
      4. Make the titles punchy and action-oriented.
      5. The 'kicker' should be short (e.g. "Pending · 2h", "Escalated", "Review", "System Check").
      6. Provide a logical relative URL for 'to' from the following VALID options ONLY: "/tasks", "/pulse", "/console", "/hrms", "/team", "/score", "/leaves", "/attendance", "/one-on-ones", "/recruiting". DO NOT invent any other routes.

      DATA CONTEXT:
      ---
      Current Time: ${currentTime || "Unknown"} (Slot: ${timeSlot || "Unknown"})
      My Active Tasks: ${JSON.stringify(myTasks || [])}
      Tasks I Assigned (in-flight): ${JSON.stringify(assignedTasks || [])}
      Recent Events: ${JSON.stringify(events || [])}
      Recent Daily Pulses: ${JSON.stringify(pulses || [])}
      ---

      INSTRUCTIONS:
      1. CRITICAL: DO NOT hallucinate. ONLY generate priorities mapped to the EXACT items provided above.
      2. RULE A (Tasks): If the user has active tasks, generate priorities referencing the exact task title and set 'to' strictly to "/tasks".
      3. RULE B (HR Check-Ins): If the user has a task related to "Admin Check-In" or "HR Check-In", flag it as URGENT, instruct them to reply, and set 'to' to "/tasks".
      4. RULE C (Time-Aware Pulses): Check the current time and active slot (morning, midday, eod). If they have not logged a pulse for this slot yet, generate a high-priority item prompting them to "Log your [Slot] Pulse" and link to "/pulse".
      5. Synthesize this down to a maximum of 5 most critical Mission Items. If the DATA CONTEXT is empty or there is nothing urgent, return an empty array (do NOT invent items).
      6. Output ONLY a valid JSON object with a single "items" key containing an array of objects.
      Each object MUST have:
      - id (string)
      - weight (number 1-100)
      - kicker (string)
      - title (string) (MUST directly reference a specific task, event, or pulse from the DATA CONTEXT)
      - body (string) (Explain exactly what needs to be done based on the real data)
      - to (string) (Use "/tasks" for tasks, "/console" for events, "/pulse" for pulses, "/hrms" for HR. DO NOT invent other routes.)
      - tone ("urgent", "warn", "info", or "neutral")
    `;

    const chatCompletion = await ai.chat.completions.create({
      messages: [{ role: "system", content: systemPrompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const text = chatCompletion.choices[0]?.message?.content || "";
    if (text) {
      const parsed = JSON.parse(text);
      res.json(parsed.items || []);
    } else {
      res.json([]);
    }
  } catch (err) {
    console.error("Groq AI Priority Generation Error:", err.message);
    // Return empty array on failure (e.g. rate limit) so frontend can silently fallback
    res.json([]);
  }
});

router.post("/template", async (req, res) => {
  try {
    const { mode, title, context, tasks } = req.body;

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: "GROQ_API_KEY is not configured on the server." });
    }

    if (!ai) {
      ai = new Groq({ apiKey: process.env.GROQ_API_KEY });
    }

    let systemPrompt = "";
    
    if (mode === "generate_template") {
      systemPrompt = `
      You are an operations manager. Generate a short, clear, and professional check-in template for operators.
      Title of check-in: ${title}
      Context: ${context || "Standard daily operations"}
      
      Output ONLY the raw text template. Use clear, proper language. DO NOT use any markdown symbols (no asterisks, no dashes, no underscores, etc). Just use plain text with colons for fields, e.g. "Drafts done: ". Keep it under 6 lines. Do not wrap in JSON.
      `;
    } else if (mode === "fill_response") {
      systemPrompt = `
      You are a high-performing operator. You need to fill out a check-in template based on your active tasks today.
      Template to fill:
      ${context}

      Your tasks today:
      ${JSON.stringify(tasks || [])}
      
      Output ONLY the completed raw text response. Fill in the fields accurately based on the tasks provided. If you don't have data for a field, put "N/A" or "0". Be extremely concise. Do not wrap in JSON.
      `;
    } else if (mode === "polish_pulse") {
      systemPrompt = `
      You are an elite business editor. The user has jotted down their daily pulse check-in.
      Your job is to structure and correct the grammar of this text.
      Text to polish:
      ${context}
      
      RULES:
      1. Fix any grammar and spelling mistakes.
      2. Format it cleanly with bullet points if it contains multiple items.
      3. Keep the original meaning and tone intact. Do not invent new things.
      4. Output ONLY the raw polished text. Do not wrap in JSON.
      `;
    } else if (mode === "generate_eod") {
      systemPrompt = `
      You are an elite business editor. The user needs to write their End of Day (EOD) pulse check-in.
      Here are their pulse updates from earlier today:
      ${context}

      Your job is to synthesize these earlier updates into a concise, professional EOD summary.
      RULES:
      1. Keep it brief and structured with bullet points.
      2. Highlight the main accomplishments and any remaining blockers based ONLY on the provided pulses.
      3. Do not invent new tasks or numbers.
      4. Output ONLY the raw text response. Do not wrap in JSON.
      `;
    } else if (mode === "create_new_template") {
      systemPrompt = `
      You are an operations manager AI. The HR/Admin wants to generate a brand new custom check-in template based on the current context.
      Scan the following context (active tasks across the organization):
      ${context}
      
      Your job is to figure out what are the most pressing questions, metrics, or blockers that the operators need to report on right now.
      Generate a professional check-in template.
      
      OUTPUT STRICTLY VALID JSON ONLY. The JSON must have the following structure:
      {
        "title": "A punchy title for this check-in (e.g., 'Emergency Ops Check' or 'Mid-day Escalation Sync')",
        "time": "Ad-hoc",
        "text": "The raw markdown text of the check-in template. Use markdown bolding (e.g. *Metric* - ) for fields they need to fill in. Keep it under 6 lines."
      }
      `;
    } else {
      return res.status(400).json({ error: "Invalid mode" });
    }

    const chatCompletion = await ai.chat.completions.create({
      messages: [{ role: "system", content: systemPrompt }],
      model: "llama-3.3-70b-versatile",
      temperature: 0.3,
      response_format: mode === "create_new_template" ? { type: "json_object" } : undefined,
    });

    const text = chatCompletion.choices[0]?.message?.content || "";
    if (mode === "create_new_template") {
      res.json(JSON.parse(text));
    } else {
      res.json({ text: text.trim() });
    }
  } catch (err) {
    console.error("Groq AI Template Generation Error:", err.message);
    res.status(500).json({ error: "Failed to generate template" });
  }
});

export default router;
