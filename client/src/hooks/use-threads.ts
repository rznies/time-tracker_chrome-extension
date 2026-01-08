import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Thread, Message } from "@shared/schema";

export function useThreads() {
  return useQuery<Thread[]>({
    queryKey: ["/api/threads"],
  });
}

export function useThread(threadId: string | null) {
  return useQuery<{ thread: Thread; messages: Message[] }>({
    queryKey: ["/api/threads", threadId],
    enabled: !!threadId,
  });
}

export function useCreateThread() {
  return useMutation({
    mutationFn: async (title?: string) => {
      const response = await apiRequest("POST", "/api/threads", { title: title || "New conversation" });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/threads"] });
    },
  });
}

export function useDeleteThread() {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/threads/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/threads"] });
    },
  });
}
