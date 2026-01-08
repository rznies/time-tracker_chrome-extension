import { useState } from "react";
import { Save, Loader2, Check, Globe, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";

interface SavePanelProps {
  onSave: (text: string, url: string) => void;
  isSaving: boolean;
  lastSaveSuccess: boolean | null;
}

export function SavePanel({ onSave, isSaving, lastSaveSuccess }: SavePanelProps) {
  const [text, setText] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);
    
    if (!text.trim()) {
      setError("Please enter some text to save");
      return;
    }
    
    if (!url.trim()) {
      setError("Please enter a source URL");
      return;
    }
    
    try {
      new URL(url);
    } catch {
      setError("Please enter a valid URL");
      return;
    }
    
    onSave(text.trim(), url.trim());
    setText("");
    setUrl("");
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="space-y-2">
        <Label htmlFor="snippet-text" className="text-sm font-medium">
          Snippet Text
        </Label>
        <Textarea
          id="snippet-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Paste or type the text you want to save..."
          className="min-h-[100px] text-sm"
          disabled={isSaving}
          data-testid="input-snippet-text"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="source-url" className="text-sm font-medium">
          Source URL
        </Label>
        <div className="relative">
          <Globe className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            id="source-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/article"
            className="pl-9 text-sm font-mono"
            disabled={isSaving}
            data-testid="input-source-url"
          />
        </div>
      </div>
      
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4" />
          {error}
        </div>
      )}
      
      <Button
        className="w-full"
        onClick={handleSave}
        disabled={isSaving || !text.trim() || !url.trim()}
        data-testid="button-save-snippet"
      >
        {isSaving ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Saving...
          </>
        ) : lastSaveSuccess === true ? (
          <>
            <Check className="h-4 w-4 mr-2" />
            Saved!
          </>
        ) : (
          <>
            <Save className="h-4 w-4 mr-2" />
            Save Snippet
          </>
        )}
      </Button>
    </Card>
  );
}
