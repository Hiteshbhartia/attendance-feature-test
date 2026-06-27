// src/components/ComingSoon.tsx

import React from "react";
import { Link } from "@tanstack/react-router";
import { Globe } from "lucide-react";

/**
 * Premium placeholder displayed when a route is hidden in launch mode.
 * No animations, clean professional look with subtle glassmorphism.
 */
export default function ComingSoon() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] bg-gradient-to-br from-primary/10 to-background/20 p-8 rounded-xl shadow-2xl backdrop-blur-sm">
      <Globe className="h-16 w-16 text-primary mb-4" />
      <h1 className="font-display text-3xl font-bold text-foreground mb-2">Coming Soon</h1>
      <p className="text-center text-muted-foreground max-w-md mb-6">
        This feature is not available in the current launch mode. It will be released in a future update.
      </p>
      <Link
        to="/"
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Back to Home
      </Link>
    </div>
  );
}
