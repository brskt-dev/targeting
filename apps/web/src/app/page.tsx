"use client";

import { useState } from "react";
import type { Lead, SearchInput, ProviderError } from "@targeting/shared";
import { SearchForm } from "@/components/search-form";
import { LeadsTable } from "@/components/leads-table";
import { Target, AlertTriangle } from "lucide-react";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";

const PLATFORM_LABELS: Record<string, string> = {
  google_search: "Google Search",
  google_maps: "Google Maps",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

export default function HomePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [providerErrors, setProviderErrors] = useState<ProviderError[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);

  async function handleSearch(input: SearchInput) {
    setLoading(true);
    setError(null);
    setLeads([]);
    setProviderErrors([]);
    setSearched(true);

    try {
      const res = await fetch(`${API_URL}/search`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error ?? "Erro ao buscar leads");
      }

      setLeads(data.results ?? []);
      setProviderErrors(data.errors ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-4 py-12 space-y-10">
        <header className="space-y-2">
          <div className="flex items-center gap-2">
            <Target className="h-7 w-7 text-primary" />
            <h1 className="text-2xl font-bold tracking-tight">Targeting</h1>
          </div>
          <p className="text-muted-foreground text-sm">
            Motor de prospecção B2B/B2C — encontre leads em múltiplas plataformas simultaneamente.
          </p>
        </header>

        <section className="rounded-xl border bg-card p-6 shadow-sm space-y-4">
          <h2 className="text-base font-semibold">Nova busca</h2>
          <SearchForm onSearch={handleSearch} loading={loading} />
        </section>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="space-y-3 text-center">
              <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="text-sm text-muted-foreground">Coletando dados das plataformas, aguarde...</p>
            </div>
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && providerErrors.length > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              Algumas plataformas falharam:{" "}
              {providerErrors.map((e) => PLATFORM_LABELS[e.platform] ?? e.platform).join(", ")}.
              Os resultados das demais plataformas estão disponíveis abaixo.
            </span>
          </div>
        )}

        {!loading && searched && leads.length === 0 && !error && (
          <div className="text-center py-12 text-muted-foreground text-sm">
            Nenhum resultado encontrado. Tente outro termo, localização ou plataforma.
          </div>
        )}

        {!loading && leads.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-base font-semibold">Resultados</h2>
            <LeadsTable leads={leads} />
          </section>
        )}
      </div>
    </main>
  );
}
