import { useEffect, useState } from "react";
import { Undo, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface UndoToastProps {
  message: string;
  onUndo: () => void;
  onDismiss: () => void;
  duration?: number; // in milliseconds
}

export function UndoToast({ message, onUndo, onDismiss, duration = 5000 }: UndoToastProps) {
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      
      if (remaining === 0) {
        clearInterval(interval);
        onDismiss();
      }
    }, 50);

    return () => clearInterval(interval);
  }, [duration, onDismiss]);

  return (
    <div 
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 bg-foreground text-background rounded-lg shadow-lg overflow-hidden min-w-[280px] max-w-[90%]"
      data-testid="toast-undo"
    >
      <div className="flex items-center justify-between gap-4 px-4 py-3">
        <span className="text-sm">{message}</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-background hover:text-background hover:bg-background/20"
            onClick={onUndo}
            data-testid="button-undo"
          >
            <Undo className="h-3.5 w-3.5 mr-1" />
            Undo
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-background hover:text-background hover:bg-background/20"
            onClick={onDismiss}
            data-testid="button-dismiss-toast"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
      {/* Progress bar */}
      <div className="h-0.5 bg-background/20">
        <div 
          className="h-full bg-primary transition-all duration-50 ease-linear"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}
