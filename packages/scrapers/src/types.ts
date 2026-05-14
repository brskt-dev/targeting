import type { Platform, Lead, SearchInput } from "@targeting/shared";

export type ScraperProvider = {
  platform: Platform;
  search(input: SearchInput): Promise<Lead[]>;
};
