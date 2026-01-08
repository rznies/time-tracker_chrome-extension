import { Plus, MessageSquare, Trash2, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Thread } from "@shared/schema";
import { formatDistanceToNow } from "date-fns";

interface ThreadSelectorProps {
  threads: Thread[];
  activeThreadId: string | null;
  onSelect: (threadId: string) => void;
  onCreate: () => void;
  onDelete: (threadId: string) => void;
  isLoading?: boolean;
}

export function ThreadSelector({
  threads,
  activeThreadId,
  onSelect,
  onCreate,
  onDelete,
  isLoading,
}: ThreadSelectorProps) {
  const activeThread = threads.find((t) => t.id === activeThreadId);

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button 
            variant="outline" 
            className="flex-1 justify-between max-w-[200px]"
            disabled={isLoading}
            data-testid="button-thread-selector"
          >
            <div className="flex items-center gap-2 min-w-0">
              <MessageSquare className="h-4 w-4 flex-shrink-0" />
              <span className="truncate text-sm">
                {activeThread?.title || "Select thread"}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 flex-shrink-0 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-[240px]">
          <ScrollArea className="max-h-[200px]">
            {threads.length === 0 ? (
              <div className="py-4 px-2 text-center text-sm text-muted-foreground">
                No conversations yet
              </div>
            ) : (
              threads.map((thread) => (
                <DropdownMenuItem
                  key={thread.id}
                  className="flex items-center justify-between gap-2 cursor-pointer"
                  onClick={() => onSelect(thread.id)}
                  data-testid={`thread-item-${thread.id}`}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm truncate">{thread.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(thread.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      onDelete(thread.id);
                    }}
                    data-testid={`button-delete-thread-${thread.id}`}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </DropdownMenuItem>
              ))
            )}
          </ScrollArea>
          <DropdownMenuSeparator />
          <DropdownMenuItem 
            onClick={onCreate}
            className="cursor-pointer"
            data-testid="button-new-thread"
          >
            <Plus className="h-4 w-4 mr-2" />
            New conversation
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
