import { useState } from "react";
import { Download, FileJson, FileText, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Snippet } from "@shared/schema";

interface ExportPanelProps {
  snippets: Snippet[];
}

export function ExportPanel({ snippets }: ExportPanelProps) {
  const [exportedFormat, setExportedFormat] = useState<"json" | "markdown" | null>(null);

  const exportAsJson = () => {
    const data = snippets.map(({ id, text, sourceUrl, sourceDomain, savedAt }) => ({
      id,
      text,
      sourceUrl,
      sourceDomain,
      savedAt,
    }));
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    downloadBlob(blob, "knowledge-vault.json");
    setExportedFormat("json");
    setTimeout(() => setExportedFormat(null), 2000);
  };

  const exportAsMarkdown = () => {
    const lines: string[] = [
      "# My Knowledge Vault",
      "",
      `Exported on ${new Date().toLocaleDateString()}`,
      "",
      `Total snippets: ${snippets.length}`,
      "",
      "---",
      "",
    ];

    snippets.forEach((snippet, index) => {
      lines.push(`## Snippet ${index + 1}`);
      lines.push("");
      lines.push(`> ${snippet.text.split("\n").join("\n> ")}`);
      lines.push("");
      lines.push(`**Source:** [${snippet.sourceDomain}](${snippet.sourceUrl})`);
      lines.push("");
      lines.push(`**Saved:** ${new Date(snippet.savedAt).toLocaleString()}`);
      lines.push("");
      lines.push("---");
      lines.push("");
    });

    const blob = new Blob([lines.join("\n")], { type: "text/markdown" });
    downloadBlob(blob, "knowledge-vault.md");
    setExportedFormat("markdown");
    setTimeout(() => setExportedFormat(null), 2000);
  };

  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  if (snippets.length === 0) {
    return null;
  }

  return (
    <Card className="p-4">
      <h3 className="text-sm font-medium mb-3">Export Your Knowledge</h3>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={exportAsJson}
          className="flex-1"
          data-testid="button-export-json"
        >
          {exportedFormat === "json" ? (
            <Check className="h-4 w-4 mr-2" />
          ) : (
            <FileJson className="h-4 w-4 mr-2" />
          )}
          JSON
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={exportAsMarkdown}
          className="flex-1"
          data-testid="button-export-markdown"
        >
          {exportedFormat === "markdown" ? (
            <Check className="h-4 w-4 mr-2" />
          ) : (
            <FileText className="h-4 w-4 mr-2" />
          )}
          Markdown
        </Button>
      </div>
    </Card>
  );
}
