import { useQuery } from "@tanstack/react-query";
import { api, unwrap } from "@/lib/api";

export function useRoutines() {
  return useQuery({ queryKey: ["routines"], queryFn: () => unwrap(api.routines.$get()) });
}

export type Routine = NonNullable<ReturnType<typeof useRoutines>["data"]>[number];
