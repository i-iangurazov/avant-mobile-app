import { useQuery } from "@tanstack/react-query";
import { stores } from "../data/stores";

export function useStores() {
  return useQuery({
    queryKey: ["stores"],
    queryFn: async () => stores
  });
}
