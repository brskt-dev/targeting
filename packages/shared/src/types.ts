export type Lead = {
  id: string;
  type: "person" | "company";
  platform: "google" | "maps" | "instagram" | "linkedin" | "website";
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
  targetType: "person" | "company";
  platform: "google" | "maps" | "instagram" | "linkedin";
  location?: string;
};

export type SearchResponse = {
  results: Lead[];
};
