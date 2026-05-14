"use client";

import { useState } from "react";
import type { SearchInput } from "@targeting/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Search } from "lucide-react";

interface SearchFormProps {
  onSearch: (input: SearchInput) => void;
  loading: boolean;
}

export function SearchForm({ onSearch, loading }: SearchFormProps) {
  const [form, setForm] = useState<SearchInput>({
    query: "",
    targetType: "company",
    platform: "google",
    location: "",
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.query.trim()) return;
    onSearch(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1.5 lg:col-span-2">
          <Label htmlFor="query">O que você busca?</Label>
          <Input
            id="query"
            placeholder="Ex: clínicas de estética, restaurantes veganos..."
            value={form.query}
            onChange={(e) => setForm({ ...form, query: e.target.value })}
            required
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="location">Localização</Label>
          <Input
            id="location"
            placeholder="Ex: Campinas, São Paulo..."
            value={form.location ?? ""}
            onChange={(e) => setForm({ ...form, location: e.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="platform">Plataforma</Label>
          <Select
            id="platform"
            value={form.platform}
            onChange={(e) =>
              setForm({ ...form, platform: e.target.value as SearchInput["platform"] })
            }
          >
            <option value="google">Google Search</option>
            <option value="maps">Google Maps</option>
          </Select>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="targetType">Tipo de alvo</Label>
          <Select
            id="targetType"
            value={form.targetType}
            onChange={(e) =>
              setForm({ ...form, targetType: e.target.value as SearchInput["targetType"] })
            }
          >
            <option value="company">Empresa</option>
            <option value="person">Pessoa</option>
          </Select>
        </div>
      </div>

      <Button type="submit" disabled={loading} className="w-full sm:w-auto">
        <Search className="h-4 w-4" />
        {loading ? "Buscando..." : "Buscar Leads"}
      </Button>
    </form>
  );
}
