import { useState, useEffect, useCallback } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProgressCounter } from "@/components/progress-counter";
import { RecentSaves } from "@/components/recent-saves";
import { SavePanel } from "@/components/save-panel";
import { ChatInterface } from "@/components/chat-interface";
import { ExportPanel } from "@/components/export-panel";
import { UndoToast } from "@/components/undo-toast";
import { useSnippets, useSaveSnippet, useDeleteSnippet, useRestoreSnippet } from "@/hooks/use-snippets";
import { useThreads, useCreateThread, useDeleteThread } from "@/hooks/use-threads";
import { useChat } from "@/hooks/use-chat";
import { BookOpen, MessageSquare, Plus, Settings } from "lucide-react";

export default function PopupPage() {
  const [activeTab, setActiveTab] = useState("saves");
  const [activeThreadId, setActiveThreadId] = useState<string | null>(null);
  const [pendingUndo, setPendingUndo] = useState<{ id: string; message: string } | null>(null);
  const [lastSaveSuccess, setLastSaveSuccess] = useState<boolean | null>(null);

  // Snippets data & mutations
  const { data: snippets = [], isLoading: isLoadingSnippets } = useSnippets();
  const saveSnippet = useSaveSnippet();
  const deleteSnippet = useDeleteSnippet();
  const restoreSnippet = useRestoreSnippet();

  // Threads data & mutations
  const { data: threads = [], isLoading: isLoadingThreads } = useThreads();
  const createThread = useCreateThread();
  const deleteThread = useDeleteThread();

  // Chat state
  const { messages, streamingContent, isSending, sendMessage, loadMessages, clearMessages } = useChat(activeThreadId);

  // Load messages when thread changes
  useEffect(() => {
    if (activeThreadId) {
      loadMessages(activeThreadId);
    } else {
      clearMessages();
    }
  }, [activeThreadId, loadMessages, clearMessages]);

  // Reset save success indicator after 2 seconds
  useEffect(() => {
    if (lastSaveSuccess !== null) {
      const timer = setTimeout(() => setLastSaveSuccess(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [lastSaveSuccess]);

  const handleSaveSnippet = useCallback(async (text: string, url: string) => {
    try {
      await saveSnippet.mutateAsync({ text, sourceUrl: url });
      setLastSaveSuccess(true);
    } catch (error) {
      setLastSaveSuccess(false);
      console.error("Failed to save snippet:", error);
    }
  }, [saveSnippet]);

  const handleDeleteSnippet = useCallback(async (id: string) => {
    try {
      await deleteSnippet.mutateAsync(id);
      setPendingUndo({ id, message: "Snippet deleted" });
    } catch (error) {
      console.error("Failed to delete snippet:", error);
    }
  }, [deleteSnippet]);

  const handleUndoDelete = useCallback(async () => {
    if (pendingUndo) {
      try {
        await restoreSnippet.mutateAsync(pendingUndo.id);
        setPendingUndo(null);
      } catch (error) {
        console.error("Failed to restore snippet:", error);
      }
    }
  }, [pendingUndo, restoreSnippet]);

  const handleCreateThread = useCallback(async () => {
    try {
      const newThread = await createThread.mutateAsync("New conversation");
      setActiveThreadId(newThread.id);
    } catch (error) {
      console.error("Failed to create thread:", error);
    }
  }, [createThread]);

  const handleDeleteThread = useCallback(async (id: string) => {
    try {
      await deleteThread.mutateAsync(id);
      if (activeThreadId === id) {
        setActiveThreadId(null);
      }
    } catch (error) {
      console.error("Failed to delete thread:", error);
    }
  }, [deleteThread, activeThreadId]);

  const handleSendMessage = useCallback(async (query: string) => {
    await sendMessage(query);
  }, [sendMessage]);

  return (
    <div 
      className="w-[400px] h-[600px] bg-background text-foreground flex flex-col overflow-hidden"
      data-testid="popup-container"
    >
      {/* Header */}
      <header className="flex items-center justify-between gap-2 px-4 py-3 border-b flex-shrink-0">
        <div className="flex items-center gap-2">
          <BookOpen className="h-5 w-5 text-primary" />
          <h1 className="text-base font-semibold">Knowledge Vault</h1>
        </div>
        <ThemeToggle />
      </header>

      {/* Progress counter */}
      <ProgressCounter snippets={snippets} />

      {/* Main content tabs */}
      <Tabs 
        value={activeTab} 
        onValueChange={setActiveTab} 
        className="flex-1 flex flex-col overflow-hidden"
      >
        <TabsList className="mx-4 mt-2 grid grid-cols-3 flex-shrink-0">
          <TabsTrigger value="saves" data-testid="tab-saves">
            <BookOpen className="h-4 w-4 mr-1.5" />
            Saves
          </TabsTrigger>
          <TabsTrigger value="chat" data-testid="tab-chat">
            <MessageSquare className="h-4 w-4 mr-1.5" />
            Chat
          </TabsTrigger>
          <TabsTrigger value="add" data-testid="tab-add">
            <Plus className="h-4 w-4 mr-1.5" />
            Add
          </TabsTrigger>
        </TabsList>

        <div className="flex-1 overflow-hidden">
          <TabsContent value="saves" className="h-full mt-0 pt-2">
            <RecentSaves
              snippets={snippets}
              isLoading={isLoadingSnippets}
              onDelete={handleDeleteSnippet}
              deletingId={deleteSnippet.isPending ? (deleteSnippet.variables as string) : null}
            />
            <div className="px-4 pb-4">
              <ExportPanel snippets={snippets} />
            </div>
          </TabsContent>

          <TabsContent value="chat" className="h-full mt-0">
            <ChatInterface
              threads={threads}
              activeThreadId={activeThreadId}
              messages={messages}
              streamingContent={streamingContent}
              isLoadingThreads={isLoadingThreads}
              isLoadingMessages={false}
              isSending={isSending}
              hasSnippets={snippets.length > 0}
              onSelectThread={setActiveThreadId}
              onCreateThread={handleCreateThread}
              onDeleteThread={handleDeleteThread}
              onSendMessage={handleSendMessage}
            />
          </TabsContent>

          <TabsContent value="add" className="h-full mt-0 p-4">
            <SavePanel
              onSave={handleSaveSnippet}
              isSaving={saveSnippet.isPending}
              lastSaveSuccess={lastSaveSuccess}
            />
          </TabsContent>
        </div>
      </Tabs>

      {/* Undo toast */}
      {pendingUndo && (
        <UndoToast
          message={pendingUndo.message}
          onUndo={handleUndoDelete}
          onDismiss={() => setPendingUndo(null)}
          duration={300000} // 5 minutes as per spec
        />
      )}
    </div>
  );
}
