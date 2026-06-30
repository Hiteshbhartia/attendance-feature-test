import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useRef, useEffect } from "react";
import { Send, Flame, Loader2 } from "lucide-react";
import { teamSummary } from "@/lib/team-metrics";
import { getRoster } from "@/lib/roster";
import { RoleGate } from "@/components/RoleGate";
import { API_URL, getToken } from "@/lib/api-client";
import { usePageTour } from "@/hooks/usePageTour";

export const Route = createFileRoute("/command")({
  component: () => (
    <RoleGate allow={["leadership"]}>
      <CommandCenter />
    </RoleGate>
  ),
  head: () => ({ meta: [{ title: "Command Center — Gharpayy Core AI" }] }),
});

type Msg = { role: "user" | "assistant"; content: string };

function parseInlineMarkdown(text: string) {
  const parts = text.split(/(\*\*.*?\*\*|__.*?__|\*.*?\*|_.*?_)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("__") && part.endsWith("__")) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>;
    }
    if (part.startsWith("*") && part.endsWith("*")) {
      return <em key={i} className="italic text-foreground">{part.slice(1, -1)}</em>;
    }
    if (part.startsWith("_") && part.endsWith("_")) {
      return <em key={i} className="italic text-foreground">{part.slice(1, -1)}</em>;
    }
    return <span key={i}>{part}</span>;
  });
}

function parseMarkdown(text: string) {
  if (!text) return null;
  text = text.replace(/\r/g, '');
  const blocks = text.split(/\n\n+/);
  
  return blocks.map((block, i) => {
    block = block.trim();
    if (!block) return null;

    // Headings
    const headingMatch = block.match(/^(#{1,6})\s+(.*)$/s);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = parseInlineMarkdown(headingMatch[2]);
      if (level === 1) return <h1 key={i} className="text-xl md:text-2xl font-bold mt-6 mb-3 text-primary tracking-tight border-b border-border/50 pb-2">{content}</h1>;
      if (level === 2) return <h2 key={i} className="text-lg font-bold mt-5 mb-2 text-primary/90">{content}</h2>;
      if (level === 3) return <h3 key={i} className="text-base font-semibold mt-4 mb-2 text-foreground">{content}</h3>;
      return <h4 key={i} className="text-sm font-semibold mt-3 mb-1 text-foreground/80">{content}</h4>;
    }
    
    // Unordered lists
    if (/^[-*]\s/m.test(block)) {
      const items = block.split(/\n(?=[-*\d])/).filter(line => /^[-*]\s/.test(line.trim()));
      if (items.length > 0) {
        return (
          <ul key={i} className="list-disc pl-5 mb-4 space-y-2 marker:text-primary/70">
            {items.map((item, j) => (
              <li key={j} className="text-foreground/90 pl-1 leading-relaxed">
                {parseInlineMarkdown(item.trim().replace(/^[-*]\s+/, ""))}
              </li>
            ))}
          </ul>
        );
      }
    }
    
    // Numbered lists
    if (/^\d+\.\s/m.test(block)) {
      const items = block.split(/\n(?=[-*\d])/).filter(line => /^\d+\.\s/.test(line.trim()));
      if (items.length > 0) {
        return (
          <ol key={i} className="list-decimal pl-5 mb-4 space-y-2 marker:text-primary/70 marker:font-medium">
            {items.map((item, j) => (
              <li key={j} className="text-foreground/90 pl-1 leading-relaxed">
                {parseInlineMarkdown(item.trim().replace(/^\d+\.\s+/, ""))}
              </li>
            ))}
          </ol>
        );
      }
    }

    // Paragraph
    return <p key={i} className="mb-4 text-foreground/90 leading-relaxed">{parseInlineMarkdown(block)}</p>;
  });
}

function CommandCenter() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  usePageTour("coach_ai_tour", [
    {
      popover: {
        title: "Coach AI",
        description: "Welcome to Coach AI. This is your intelligent operating assistant that analyzes your live team data and gives you actionable coaching advice.",
        side: "over",
        align: "center",
      }
    },
    {
      element: "#tour-coach-suggestions",
      popover: { title: "Quick Prompts", description: "Click any of these generated prompts to instantly ask Coach AI to diagnose performance or analyze top performers.", side: "top", align: "start" }
    },
    {
      element: "#tour-coach-input",
      popover: { title: "Execute Query", description: "Type your own specific questions here. Try asking who is at risk of missing their KPI targets today.", side: "top", align: "center" }
    }
  ]);

  const dynamicSuggestions = useMemo(() => {
    const roster = getRoster();
    const summary = teamSummary(roster);
    
    // Fallback if no roster data
    if (!roster.length) {
      const fallbackPool = [
        "What are our top priorities today?",
        "Generate a general team performance summary.",
        "How can we improve conversion rates?",
        "What are the best practices for handling stale leads?",
        "What is the market outlook for this quarter?",
        "Give me a quick breakdown of standard operating procedures.",
        "How can we better support our zone leaders?",
        "What are the key metrics we should track this week?",
        "Outline a strategy to decrease lead response time.",
        "What are the most common blockers for our sales team?",
      ];
      const todaySeed = new Date().getDate();
      return [
        fallbackPool[todaySeed % fallbackPool.length],
        fallbackPool[(todaySeed + 1) % fallbackPool.length],
        fallbackPool[(todaySeed + 4) % fallbackPool.length],
        fallbackPool[(todaySeed + 7) % fallbackPool.length],
      ];
    }

    // Pick random items for variety
    const randomEmployee = roster[Math.floor(Math.random() * roster.length)];
    const topPerformer = summary.top || randomEmployee;
    const bottomPerformer = summary.bottom || randomEmployee;
    
    // Get unique zones
    const zones = Array.from(new Set(roster.map(e => e.team).filter(Boolean)));
    const randomZone = zones.length > 0 ? zones[Math.floor(Math.random() * zones.length)] : "the field";

    const list = [];
    
    // Suggestion 1: Focus on Top Performers or specific zone
    if (Math.random() > 0.5 && zones.length > 0) {
      list.push(`Who are my A players in ${randomZone} today and why?`);
    } else {
      list.push(`Why is ${topPerformer.name} leading in performance today?`);
    }

    // Suggestion 2: War Room or General Summary
    if (zones.length > 1) {
      list.push(`Generate today's war room summary comparing ${zones[0]} and ${zones[1]}.`);
    } else {
      list.push(`Generate today's complete operational war room summary.`);
    }

    // Suggestion 3: Corrective action
    if (summary.bottom && summary.bottom.id !== summary.top?.id) {
      list.push(`Diagnose ${summary.bottom.name}'s performance. Give me the exact corrective action.`);
    } else {
      list.push(`What specific coaching does ${randomEmployee.name} need to improve conversions?`);
    }

    // Suggestion 4: Risk / Leads
    if (randomEmployee.leadsActive > 0) {
      list.push(`Which of ${randomEmployee.name}'s ${randomEmployee.leadsActive} active leads are at risk of being lost?`);
    } else {
      list.push("Which leads across the entire team are at risk of going stale today?");
    }

    return list;
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  async function send(text: string) {
    if (!text.trim() || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    const snapshot = {
      summary: teamSummary(getRoster()),
      employees: getRoster(),
    };

    try {
      const token = getToken();
      const baseUrl = API_URL || "/api";
      const resp = await fetch(`${baseUrl}/operator/coach`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ messages: next, snapshot }),
      });

      if (!resp.ok || !resp.body) {
        if (resp.status === 429) throw new Error("Rate limited. Try again in a moment.");
        if (resp.status === 402) throw new Error("AI credits exhausted. Add funds to workspace.");
        throw new Error("AI brain offline.");
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let textBuffer = "";
      let assistantText = "";
      setMessages((p) => [...p, { role: "assistant", content: "" }]);

      let done = false;
      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        textBuffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = textBuffer.indexOf("\n")) !== -1) {
          let line = textBuffer.slice(0, nl);
          textBuffer = textBuffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") {
            done = true;
            break;
          }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              assistantText += delta;
              setMessages((p) =>
                p.map((m, i) => (i === p.length - 1 ? { ...m, content: assistantText } : m)),
              );
            }
          } catch {
            textBuffer = line + "\n" + textBuffer;
            break;
          }
        }
      }
    } catch (e) {
      setMessages((p) => [
        ...p,
        { role: "assistant", content: `⚠️ ${e instanceof Error ? e.message : "Unknown error"}` },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col min-h-[calc(100vh-3.5rem)] bg-background/50">
      <header className="px-6 md:px-12 py-5 md:py-6 border-b border-border/40 bg-card/40 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-3 max-w-4xl mx-auto">
          <div className="h-10 w-10 rounded-xl bg-primary shadow-lg shadow-primary/20 flex items-center justify-center shrink-0">
            <Flame className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold tracking-tight">Command Center</h1>
            <p className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest mt-0.5">
              Central operating intelligence · live snapshot loaded
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 w-full px-4 md:px-8 py-6 md:py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {messages.length === 0 && (
            <div className="text-center py-10 md:py-16">
              <div className="font-display text-2xl font-semibold mb-2 tracking-tight">
                Ask the brain.
              </div>
              <p className="text-muted-foreground text-sm mb-8">
                Direct. Measurable. Actionable. No fluff.
              </p>
              <div id="tour-coach-suggestions" className="grid grid-cols-1 md:grid-cols-2 gap-3 max-w-2xl mx-auto">
                {dynamicSuggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="text-left p-4 rounded-xl border border-border/60 bg-card/50 hover:border-primary/50 hover:bg-primary/5 hover:shadow-md transition-all group"
                  >
                    <span className="text-sm font-medium text-foreground/90 group-hover:text-primary transition-colors leading-relaxed">
                      {s}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[95%] md:max-w-[88%] rounded-2xl px-5 py-4 text-sm leading-relaxed ${
                  m.role === "user"
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/10"
                    : "bg-card text-card-foreground border border-border/50 shadow-sm"
                }`}
              >
                <div className="font-sans">
                  {m.content ? parseMarkdown(m.content) : 
                    (loading ? (
                      <div className="flex items-center gap-2 text-muted-foreground py-1">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm">Synthesizing...</span>
                      </div>
                    ) : (
                      ""
                    ))}
                </div>
              </div>
            </div>
          ))}
          <div ref={scrollRef} className="h-4" />
        </div>
      </div>

      <div className="sticky bottom-0 z-20 w-full bg-gradient-to-t from-background via-background to-transparent pt-8 pb-4 md:pb-6 px-4 md:px-8">
        <form
          id="tour-coach-input"
          onSubmit={(e) => {
            e.preventDefault();
            send(input);
          }}
          className="max-w-4xl mx-auto relative flex flex-col sm:flex-row gap-2 items-end sm:items-center rounded-2xl border border-border/50 bg-card/80 backdrop-blur-xl shadow-lg p-1.5 md:p-2 transition-all focus-within:border-primary/50 focus-within:ring-4 focus-within:ring-primary/10"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Executive query... (e.g. Diagnose team productivity)"
            className="flex-1 w-full px-4 py-2.5 bg-transparent text-sm md:text-base focus:outline-none placeholder:text-muted-foreground/60"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            Execute
          </button>
        </form>
      </div>
    </div>
  );
}
