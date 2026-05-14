"use client";

import { useState } from "react";
import type { Platform, SearchInput } from "@targeting/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Search } from "lucide-react";

const PLATFORMS: { value: Platform; label: string }[] = [
  { value: "google_search", label: "Google Search" },
  { value: "google_maps", label: "Google Maps" },
  { value: "instagram", label: "Instagram" },
  { value: "linkedin", label: "LinkedIn" },
];

interface SearchFormProps {
  onSearch: (input: SearchInput) => void;
  loading: boolean;
}

export function SearchForm({ onSearch, loading }: SearchFormProps) {
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("");
  const [targetType, setTargetType] = useState<SearchInput["targetType"]>("company");
  const [platforms, setPlatforms] = useState<Platform[]>(["google_search", "google_maps"]);

  function togglePlatform(platform: Platform) {
    setPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform],
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim() || platforms.length === 0) return;
    onSearch({ query: query.trim(), location: location.trim() || undefined, targetType, platforms });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="query">O que você busca?</Label>
          <Input
            id="query"
            placeholder="Ex: clínicas de estética, restaurantes veganos..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="location">Localização</Label>
          <Input
            id="location"
            placeholder="Ex: Campinas, São Paulo..."
            value={location}
            onChange={(e) => setLocation(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="targetType">Tipo de alvo</Label>
          <Select
            id="targetType"
            value={targetType}
            onChange={(e) =>
              setTargetType(e.target.value as SearchInput["targetType"])
            }
          >
            <option value="company">Empresa</option>
            <option value="person">Pessoa</option>
          </Select>
        </div>
      </div>

      <div className="space-y-2">
        <Label>Plataformas</Label>
        <div className="flex flex-wrap gap-2">
          {PLATFORMS.map(({ value, label }) => {
            const selected = platforms.includes(value);
            return (
              <button
                key={value}
                type="button"
                onClick={() => togglePlatform(value)}
                className={[
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  selected
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-input bg-background text-foreground hover:bg-accent",
                ].join(" ")}
              >
                {label}
              </button>
            );
          })}
        </div>
        {platforms.length === 0 && (
          <p className="text-xs text-destructive">Selecione pelo menos uma plataforma.</p>
        )}
      </div>

      <Button type="submit" disabled={loading || platforms.length === 0}>
        <Search className="h-4 w-4" />
        {loading ? "Buscando..." : "Buscar Leads"}
      </Button>
    </form>
  );
}
