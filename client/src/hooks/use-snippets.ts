import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Snippet, SaveSnippetRequest } from "@shared/schema";

export function useSnippets() {
  return useQuery<Snippet[]>({
    queryKey: ["/api/snippets"],
  });
}

export function useSaveSnippet() {
  return useMutation({
    mutationFn: async (data: SaveSnippetRequest) => {
      const response = await apiRequest("POST", "/api/snippets", data);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
    },
  });
}

export function useDeleteSnippet() {
  return useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/snippets/${id}`);
      return id;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
    },
  });
}

export function useRestoreSnippet() {
  return useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", `/api/snippets/${id}/restore`);
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/snippets"] });
    },
  });
}
