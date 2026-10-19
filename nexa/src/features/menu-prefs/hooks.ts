"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api, type Envelope } from "@/lib/api/client";
import { EMPTY_MENU_PREFS, type MenuPrefs } from "./rules";

const KEY = ["menu-prefs"] as const;

/** The signed-in person's sidebar layout; the default layout until it has loaded or if it cannot be read. */
export function useMenuPrefs() {
  const query = useQuery({
    queryKey: KEY,
    queryFn: () => api.get<Envelope<MenuPrefs>>("/api/me/menu-prefs"),
    staleTime: 5 * 60_000,
  });
  const prefs = query.data?.data ?? EMPTY_MENU_PREFS;

  const qc = useQueryClient();
  const save = useMutation({
    mutationFn: (next: MenuPrefs) => api.put<Envelope<MenuPrefs>>("/api/me/menu-prefs", next),
    onSuccess: (res) => qc.setQueryData(KEY, res),
  });
  const reset = useMutation({
    mutationFn: () => api.del<Envelope<MenuPrefs>>("/api/me/menu-prefs"),
    onSuccess: (res) => qc.setQueryData(KEY, res),
  });

  return { prefs, save, reset, isLoading: query.isLoading };
}
