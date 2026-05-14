export type Platform = "google_search" | "google_maps" | "instagram" | "linkedin";

export type TargetType = "person" | "company";

export type ScrapeEffort = "fast" | "balanced" | "deep";

export type Lead = {
  id: string;
  type: TargetType;
  platform: Platform;
  name?: string;
  username?: string;
  description?: string;
  website?: string;
  profileUrl?: string;
  sourceUrl: string;
  location?: string;
  followers?: number;
  contact?: {
    email?: string;
    phone?: string;
    whatsapp?: string;
  };
  score?: number;
};

export type SearchInput = {
  query: string;
  location?: string;
  targetType: TargetType;
  platforms: Platform[];
  scrapeEffort?: ScrapeEffort;
};

export type ProviderError = {
  platform: Platform;
  message: string;
};

export type SearchResponse = {
  results: Lead[];
  errors: ProviderError[];
};
