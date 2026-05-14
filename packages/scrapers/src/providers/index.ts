import type { Platform } from "@targeting/shared";
import type { ScraperProvider } from "../types";
import { googleSearchProvider } from "./google-search.provider";
import { googleMapsProvider } from "./google-maps.provider";
import { instagramProvider } from "./instagram.provider";
import { linkedinProvider } from "./linkedin.provider";

export const registry: Record<Platform, ScraperProvider> = {
  google_search: googleSearchProvider,
  google_maps: googleMapsProvider,
  instagram: instagramProvider,
  linkedin: linkedinProvider,
};
