import { useState } from "react";
import { ExternalLink, Trash2, ChevronDown, ChevronUp, Undo } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Snippet } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface SnippetCardProps {
  snippet: Snippet;
  onDelete?: (id: string) => void;
  isDeleting?: boolean;
  compact?: boolean;
}

export function SnippetCard({ snippet, onDelete, isDeleting, compact = false }: SnippetCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [showActions, setShowActions] = useState(false);
  
  const truncatedText = snippet.text.length > 150 
    ? snippet.text.slice(0, 150) + "..." 
    : snippet.text;
  
  const shouldTruncate = snippet.text.length > 150;
  const displayText = isExpanded ? snippet.text : truncatedText;
  
  const timeAgo = formatDistanceToNow(new Date(snippet.savedAt), { addSuffix: true });

  return (
    <Card 
      className={`relative group ${compact ? 'p-3' : 'p-4'} hover-elevate transition-all`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
      data-testid={`card-snippet-${snippet.id}`}
    >
      <div className="space-y-2">
        <p className={`${compact ? 'text-xs' : 'text-sm'} leading-relaxed text-foreground`}>
          {displayText}
        </p>
        
        {shouldTruncate && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={() => setIsExpanded(!isExpanded)}
            data-testid={`button-expand-${snippet.id}`}
          >
            {isExpanded ? (
              <>
                <ChevronUp className="h-3 w-3 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="h-3 w-3 mr-1" />
                Show more
              </>
            )}
          </Button>
        )}
        
        <div className="flex items-center justify-between gap-2 pt-1">
          <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono min-w-0">
            <span className="truncate">{snippet.sourceDomain}</span>
            <span className="text-border">|</span>
            <span className="whitespace-nowrap">{timeAgo}</span>
          </div>
          
          <a
            href={snippet.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-muted-foreground hover:text-foreground transition-colors"
            data-testid={`link-source-${snippet.id}`}
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
      
      {onDelete && (
        <div 
          className={`absolute top-2 right-2 transition-opacity duration-150 ${
            showActions ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ visibility: showActions ? 'visible' : 'hidden' }}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground hover:text-destructive"
            onClick={() => onDelete(snippet.id)}
            disabled={isDeleting}
            data-testid={`button-delete-${snippet.id}`}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </Card>
  );
}

interface CitationCardProps {
  snippet: {
    id: string;
    text: string;
    sourceUrl: string;
    sourceDomain: string;
  };
}

export function CitationCard({ snippet }: CitationCardProps) {
  return (
    <div 
      className="p-3 bg-muted/50 rounded-md border border-border/50"
      data-testid={`citation-${snippet.id}`}
    >
      <p className="text-xs leading-relaxed text-foreground line-clamp-3">
        {snippet.text}
      </p>
      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="text-xs text-muted-foreground font-mono truncate">
          {snippet.sourceDomain}
        </span>
        <a
          href={snippet.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
