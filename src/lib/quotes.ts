import { Zap, Target, Lightbulb, BookOpen, LucideIcon } from "lucide-react";

export type QuoteData = {
  category: string;
  iconName: "zap" | "target" | "lightbulb" | "book";
  prefix: string;
  text: string;
  sourceName: string;
  sourceUrl: string;
};

export const quotes: QuoteData[] = [
  {
    category: "LEARNING & GROWTH • DAILY HABITS",
    iconName: "zap",
    prefix: "gharpayy Daily Habit:",
    text: "If it has red in it, our red-sensitive neurons are involved in the imagining. They then automatically tune themselves, and inhibit other neurons (the ones for the colors you're not interested...",
    sourceName: "The History of Cognitive Overload",
    sourceUrl: "https://fs.blog/cognitive-overload",
  },
  {
    category: "LEARNING & GROWTH • DECISION MAKING",
    iconName: "target",
    prefix: "gharpayy Decision Tip:",
    text: "Well, I think that if you're straight forward and clear about the way that you're going to operate, then you can operate in whatever way you choose. We don't even take a position on whether o...",
    sourceName: "Jeff Bezos: Big Things Start Small",
    sourceUrl: "https://fs.blog/jeff-bezos/",
  },
  {
    category: "LEARNING & GROWTH • INSIGHTS",
    iconName: "lightbulb",
    prefix: "gharpayy Insight:",
    text: "The attachment to beliefs is The greatest shackle. To be free is To know that One does not know.",
    sourceName: "The Lost Writings of Wu Hsin",
    sourceUrl: "https://fs.blog/the-lost-writings-of-wu-hsin/",
  },
  {
    category: "LEARNING & GROWTH • MINDSET",
    iconName: "book",
    prefix: "gharpayy Mindset:",
    text: "Expectation is the grandfather of Disappointment. The world can never Own a man Who wants nothing.",
    sourceName: "The Lost Writings of Wu Hsin",
    sourceUrl: "https://fs.blog/the-lost-writings-of-wu-hsin/",
  }
];
