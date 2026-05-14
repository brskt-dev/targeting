"use client";

import type { Lead, Platform } from "@targeting/shared";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";

const PLATFORM_LABELS: Record<Platform, string> = {
  google_search: "Google Search",
  google_maps: "Google Maps",
  instagram: "Instagram",
  linkedin: "LinkedIn",
};

interface LeadsTableProps {
  leads: Lead[];
}

function exportCsv(leads: Lead[]) {
  const headers = [
    "Nome",
    "Tipo",
    "Plataforma",
    "Localização",
    "Website",
    "Profile URL",
    "Source URL",
    "Email",
    "Telefone",
    "Score",
  ];

  const rows = leads.map((l) => [
    l.name ?? "",
    l.type === "company" ? "Empresa" : "Pessoa",
    PLATFORM_LABELS[l.platform] ?? l.platform,
    l.location ?? "",
    l.website ?? "",
    l.profileUrl ?? "",
    l.sourceUrl,
    l.contact?.email ?? "",
    l.contact?.phone ?? "",
    l.score != null ? String(l.score) : "",
  ]);

  const csv = [headers, ...rows]
    .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(","))
    .join("\n");

  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `leads_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function LeadsTable({ leads }: LeadsTableProps) {
  if (leads.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {leads.length} lead{leads.length !== 1 ? "s" : ""} encontrado
          {leads.length !== 1 ? "s" : ""}
        </p>
        <Button variant="outline" size="sm" onClick={() => exportCsv(leads)}>
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Nome</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Plataforma</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Localização</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Website</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Contato</th>
              <th className="px-4 py-3 text-left font-medium text-muted-foreground">Link</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {leads.map((lead) => (
              <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                <td className="px-4 py-3">
                  <div className="font-medium">{lead.name ?? "—"}</div>
                  {lead.username && (
                    <div className="text-xs text-muted-foreground mt-0.5">@{lead.username}</div>
                  )}
                  {lead.description && !lead.username && (
                    <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                      {lead.description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3">
                  <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium">
                    {PLATFORM_LABELS[lead.platform]}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{lead.location ?? "—"}</td>
                <td className="px-4 py-3">
                  {lead.website ? (
                    <a
                      href={lead.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline truncate max-w-[180px] inline-block"
                    >
                      {lead.website.replace(/^https?:\/\//, "")}
                    </a>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {lead.contact?.phone ?? lead.contact?.email ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <a
                    href={lead.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
