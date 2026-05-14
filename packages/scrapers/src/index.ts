import type { Lead, SearchInput } from "@targeting/shared";
import { googleProvider } from "./providers/google.provider";
import { mapsProvider } from "./providers/maps.provider";

export async function runSearch(input: SearchInput): Promise<Lead[]> {
  switch (input.platform) {
    case "google":
      return googleProvider(input);
    case "maps":
      return mapsProvider(input);
    default:
      throw new Error(`Platform "${input.platform}" not supported yet`);
  }
}

export { googleProvider } from "./providers/google.provider";
export { mapsProvider } from "./providers/maps.provider";
