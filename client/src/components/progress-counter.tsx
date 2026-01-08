import { Sparkles } from "lucide-react";
import type { Snippet } from "@shared/schema";

interface ProgressCounterProps {
  snippets: Snippet[];
}

export function ProgressCounter({ snippets }: ProgressCounterProps) {
  const insightCount = snippets.length;
  const domains = new Set(snippets.map((s) => s.sourceDomain));
  const domainCount = domains.size;

  if (insightCount === 0) {
    return null;
  }

  return (
    <div 
      className="flex items-center gap-2 px-4 py-2 text-sm"
      data-testid="text-progress-counter"
    >
      <Sparkles className="h-4 w-4 text-primary" />
      <span className="text-muted-foreground">
        You have{" "}
        <span className="font-semibold text-foreground">{insightCount}</span>
        {" "}insight{insightCount !== 1 ? "s" : ""} across{" "}
        <span className="font-semibold text-foreground">{domainCount}</span>
        {" "}domain{domainCount !== 1 ? "s" : ""}
      </span>
    </div>
  );
}
