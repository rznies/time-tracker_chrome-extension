import { SnippetCard } from "./snippet-card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { FileText } from "lucide-react";
import type { Snippet } from "@shared/schema";

interface RecentSavesProps {
  snippets: Snippet[];
  isLoading: boolean;
  onDelete: (id: string) => void;
  deletingId?: string | null;
}

export function RecentSaves({ snippets, isLoading, onDelete, deletingId }: RecentSavesProps) {
  if (isLoading) {
    return (
      <div className="space-y-3 p-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-16 w-full rounded-lg" />
          </div>
        ))}
      </div>
    );
  }

  if (snippets.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <div className="rounded-full bg-muted p-4 mb-4">
          <FileText className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-sm font-medium text-foreground mb-1">
          No saved snippets yet
        </h3>
        <p className="text-xs text-muted-foreground max-w-[200px]">
          Highlight text on any webpage and click Save to start building your knowledge vault.
        </p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-[400px]">
      <div className="space-y-3 p-4" data-testid="list-recent-saves">
        {snippets.map((snippet) => (
          <SnippetCard
            key={snippet.id}
            snippet={snippet}
            onDelete={onDelete}
            isDeleting={deletingId === snippet.id}
          />
        ))}
      </div>
    </ScrollArea>
  );
}
