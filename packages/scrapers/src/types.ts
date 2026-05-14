import type { Platform, Lead, SearchInput } from "@targeting/shared";
import type { BrowserContext } from "playwright";

export type ScraperProvider = {
  platform: Platform;
  search(input: SearchInput, sharedContext?: BrowserContext): Promise<Lead[]>;
};
