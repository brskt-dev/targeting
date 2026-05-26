"use client";

import { useEffect, useState } from "react";
import type { PlatformConnection } from "@targeting/shared";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X } from "lucide-react";

export type ConnectionFormValues = {
  name: string;
  loginUrl: string;
  platformDescription?: string;
  dataLocations?: string;
  knownQuirks?: string;
};

export function ConnectionDialog({
  open,
  onClose,
  onSubmit,
  initial,
  title,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (v: ConnectionFormValues) => void;
  initial?: PlatformConnection;
  title: string;
  submitting?: boolean;
}) {
  const [name, setName] = useState("");
  const [loginUrl, setLoginUrl] = useState("");
  const [platformDescription, setPlatformDescription] = useState("");
  const [dataLocations, setDataLocations] = useState("");
  const [knownQuirks, setKnownQuirks] = useState("");

  useEffect(() => {
    if (open) {
      setName(initial?.name ?? "");
      setLoginUrl(initial?.loginUrl ?? "");
      setPlatformDescription(initial?.platformDescription ?? "");
      setDataLocations(initial?.dataLocations ?? "");
      setKnownQuirks(initial?.knownQuirks ?? "");
    }
  }, [open, initial]);

  if (!open) return null;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !loginUrl.trim()) return;
    onSubmit({
      name: name.trim(),
      loginUrl: loginUrl.trim(),
      platformDescription: platformDescription.trim() || undefined,
      dataLocations: dataLocations.trim() || undefined,
      knownQuirks: knownQuirks.trim() || undefined,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="w-full max-w-2xl rounded-2xl border border-border bg-card shadow-2xl">
        <header className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </header>

        <form onSubmit={submit} className="px-5 py-5 space-y-4 max-h-[80vh] overflow-auto scroll-thin">
          <div>
            <Label htmlFor="conn-name">Nome da plataforma</Label>
            <Input
              id="conn-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: CRM da minha clínica"
              className="mt-1"
            />
          </div>

          <div>
            <Label htmlFor="conn-url">URL de login</Label>
            <Input
              id="conn-url"
              value={loginUrl}
              onChange={(e) => setLoginUrl(e.target.value)}
              placeholder="https://seu-sistema.exemplo.com"
              className="mt-1"
            />
          </div>

          <div className="pt-2 border-t border-border space-y-4">
            <p className="text-xs text-muted-foreground">
              Os campos abaixo são <strong className="text-foreground/90">opcionais mas muito úteis</strong> —
              o agente injeta esse contexto no prompt do LLM. Quanto mais específico, melhor a navegação.
            </p>

            <div>
              <Label htmlFor="conn-desc">Descrição da plataforma</Label>
              <textarea
                id="conn-desc"
                value={platformDescription}
                onChange={(e) => setPlatformDescription(e.target.value)}
                placeholder="Ex: CRM clínico Klingo. Tem módulos no menu lateral: Call Center (ligações), Recepção (agenda do dia), Bússola, Pagamentos."
                className="mt-1 w-full min-h-[80px] rounded-lg border border-input bg-input px-3 py-2 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="conn-locations">Onde estão os dados de interesse</Label>
              <textarea
                id="conn-locations"
                value={dataLocations}
                onChange={(e) => setDataLocations(e.target.value)}
                placeholder="Ex: Pacientes agendados ficam em /recepcao, com um filtro de data e botão Buscar. Cada linha tem nome, idade, especialidade, profissional, plano."
                className="mt-1 w-full min-h-[80px] rounded-lg border border-input bg-input px-3 py-2 text-sm"
              />
            </div>

            <div>
              <Label htmlFor="conn-quirks">Peculiaridades / atenções</Label>
              <textarea
                id="conn-quirks"
                value={knownQuirks}
                onChange={(e) => setKnownQuirks(e.target.value)}
                placeholder='Ex: A lista só recarrega ao clicar "Buscar" após mudar a data. As abas Agendado/Faltoso/Atendido filtram por status — para datas passadas use Todos.'
                className="mt-1 w-full min-h-[80px] rounded-lg border border-input bg-input px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-border">
            <Button type="button" variant="ghost" onClick={onClose}>Cancelar</Button>
            <Button type="submit" disabled={submitting || !name.trim() || !loginUrl.trim()}>
              {submitting ? "Salvando..." : "Salvar"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
