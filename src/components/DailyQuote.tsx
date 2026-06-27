import { useState, useEffect } from "react";
import { quotes } from "@/lib/quotes";
import { Zap, Target, Lightbulb, BookOpen, ExternalLink, Shuffle } from "lucide-react";

export function DailyQuote() {
  const [quoteIdx, setQuoteIdx] = useState(0);

  useEffect(() => {
    // Pick a random quote based on the current day so everyone sees the same one each day (initially)
    const dayOfYear = Math.floor((Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000);
    setQuoteIdx(dayOfYear % quotes.length);
  }, []);

  const handleShuffle = () => {
    let newIdx;
    do {
      newIdx = Math.floor(Math.random() * quotes.length);
    } while (newIdx === quoteIdx && quotes.length > 1);
    setQuoteIdx(newIdx);
  };

  const currentQuote = quotes[quoteIdx];
  if (!currentQuote) return null;

  const dayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toUpperCase();
  
  // Resolve the appropriate icon component
  const getIcon = () => {
    switch (currentQuote.iconName) {
      case "target": return <Target className="h-5 w-5 text-orange-500 shrink-0 fill-orange-500/20 mt-0.5" />;
      case "lightbulb": return <Lightbulb className="h-5 w-5 text-orange-500 shrink-0 fill-orange-500/20 mt-0.5" />;
      case "book": return <BookOpen className="h-5 w-5 text-orange-500 shrink-0 fill-orange-500/20 mt-0.5" />;
      case "zap":
      default: return <Zap className="h-5 w-5 text-orange-500 shrink-0 fill-orange-500 mt-0.5" />;
    }
  };

  return (
    <section id="tour-home-quote" className="rounded-xl border border-orange-100 dark:border-orange-900/30 bg-orange-50/60 dark:bg-orange-950/20 p-4 md:p-5 mb-6 relative overflow-hidden flex flex-col gap-3">
      {/* Background Quote Mark */}
      <div className="absolute -top-6 -left-2 text-[120px] leading-none font-serif font-black text-orange-500/10 select-none z-0">
        99
      </div>

      <header className="relative z-10 flex items-center justify-between text-[10px] font-mono uppercase tracking-widest text-orange-500">
        <div className="flex items-center gap-2">
          <span>{dayName} — {currentQuote.category}</span>
        </div>
        <button 
          onClick={handleShuffle}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
        >
          <Shuffle className="h-3 w-3" />
          <span>SHUFFLE</span>
        </button>
      </header>

      <div className="relative z-10 flex gap-2">
        {getIcon()}
        <p className="text-sm md:text-base font-medium leading-relaxed text-foreground/90">
          <span className="font-semibold text-foreground">{currentQuote.prefix} </span>
          "{currentQuote.text}"
        </p>
      </div>

      <footer className="relative z-10 mt-1 pl-7 flex flex-col items-start gap-1.5">
        <a 
          href={currentQuote.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-orange-500 transition-colors"
        >
          — {currentQuote.sourceName}
          <ExternalLink className="h-3 w-3" />
        </a>
      </footer>
    </section>
  );
}
