import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Search, X, Building2 } from "lucide-react";

const INSTITUTION_TYPES = [
  "Universidade",
  "Instituto Federal",
  "Faculdade",
  "Centro Universitário",
  "Escola",
  "Empresa",
  "ONG",
  "Órgão Público",
  "Hospital",
  "Outro",
];

interface InstitutionValue {
  institution_id: string | null;
  institution_name: string;
  institution_custom_name: string | null;
  institution_type: string | null;
  institution_sigla?: string | null;
}

interface Props {
  value: InstitutionValue;
  onChange: (value: InstitutionValue) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
}

interface Institution {
  id: string;
  name: string;
  sigla: string | null;
  uf: string | null;
  municipio: string | null;
  organization_type: string | null;
}

/** Format institution display as "Nome (SIGLA)" or just "Nome" if no sigla */
export function formatInstitutionDisplay(name: string, sigla?: string | null): string {
  if (!name) return "";
  if (sigla && sigla.trim()) return `${name} (${sigla.trim().toUpperCase()})`;
  return name;
}

const InstitutionSelector = ({ value, onChange, disabled, required, label }: Props) => {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [isCustom, setIsCustom] = useState(!!value.institution_custom_name && !value.institution_id);
  const [customSigla, setCustomSigla] = useState(value.institution_sigla || "");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const { data: results, isLoading } = useQuery({
    queryKey: ["institutions-search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) return [];
      const { data, error } = await supabase
        .from("institutions")
        .select("id, name, sigla, uf, municipio, organization_type")
        .eq("is_active", true)
        .or(`name.ilike.%${debouncedSearch}%,sigla.ilike.%${debouncedSearch}%`)
        .limit(20);
      if (error) throw error;
      return data as Institution[];
    },
    enabled: isOpen && !isCustom && debouncedSearch.length >= 2,
  });

  const handleSelect = useCallback((inst: Institution) => {
    onChange({
      institution_id: inst.id,
      institution_name: inst.name,
      institution_custom_name: null,
      institution_type: inst.organization_type,
      institution_sigla: inst.sigla,
    });
    setSearch("");
    setIsOpen(false);
  }, [onChange]);

  const handleClear = useCallback(() => {
    onChange({
      institution_id: null,
      institution_name: "",
      institution_custom_name: null,
      institution_type: null,
      institution_sigla: null,
    });
    setSearch("");
    setIsCustom(false);
    setCustomSigla("");
  }, [onChange]);

  const toggleCustom = useCallback((checked: boolean) => {
    setIsCustom(checked);
    if (checked) {
      onChange({
        institution_id: null,
        institution_name: value.institution_custom_name || "",
        institution_custom_name: value.institution_custom_name || "",
        institution_type: value.institution_type || null,
        institution_sigla: customSigla || null,
      });
      setSearch("");
      setIsOpen(false);
    } else {
      handleClear();
    }
  }, [onChange, value, handleClear, customSigla]);

  const hasSelection = !!value.institution_id;

  // Derive display name with sigla
  const displayName = hasSelection
    ? formatInstitutionDisplay(value.institution_name, value.institution_sigla)
    : value.institution_name;

  // Sigla validation for custom mode
  const siglaClean = customSigla.trim();
  const siglaValid = siglaClean.length >= 2 && siglaClean.length <= 10;

  return (
    <div ref={containerRef} className="space-y-2">
      {label && (
        <Label className="text-sm font-medium">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      {!isCustom && (
        <>
          {hasSelection ? (
            <div className="flex items-center gap-2 p-2.5 rounded-md border border-input bg-background">
              <Building2 className="w-4 h-4 text-primary shrink-0" />
              <span className="text-sm truncate flex-1">{displayName}</span>
              {value.institution_type && (
                <span className="text-xs text-muted-foreground shrink-0">{value.institution_type}</span>
              )}
              {!disabled && (
                <button type="button" onClick={handleClear} className="p-0.5 hover:bg-muted rounded">
                  <X className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
              )}
            </div>
          ) : (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onFocus={() => setIsOpen(true)}
                placeholder="Buscar instituição pelo nome ou sigla..."
                className="pl-9"
                disabled={disabled}
              />
            </div>
          )}

          {/* Dropdown */}
          {isOpen && !disabled && !hasSelection && (
            <div className="relative z-50">
              <div className="absolute w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {isLoading ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  </div>
                ) : debouncedSearch.length < 2 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Digite ao menos 2 caracteres para buscar
                  </div>
                ) : !results || results.length === 0 ? (
                  <div className="py-4 text-center text-sm text-muted-foreground">
                    Nenhuma instituição encontrada. Marque a opção abaixo para informar manualmente.
                  </div>
                ) : (
                  results.map((inst) => (
                    <div
                      key={inst.id}
                      onClick={() => handleSelect(inst)}
                      className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors border-b border-border/50 last:border-0"
                    >
                      <Building2 className="w-4 h-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {inst.name}
                          {inst.sigla && <span className="text-muted-foreground font-normal"> ({inst.sigla})</span>}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">
                          {[inst.organization_type, inst.municipio, inst.uf].filter(Boolean).join(" · ")}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Custom toggle */}
      <div className="flex items-center gap-2">
        <Checkbox
          id="institution-custom"
          checked={isCustom}
          onCheckedChange={(v) => toggleCustom(!!v)}
          disabled={disabled}
        />
        <Label htmlFor="institution-custom" className="cursor-pointer text-sm text-muted-foreground">
          Não encontrei / Adicionar nova instituição
        </Label>
      </div>

      {/* Custom fields */}
      {isCustom && (
        <div className="space-y-3 pl-6 border-l-2 border-border">
          <div>
            <Label>
              Nome completo da instituição <span className="text-destructive">*</span>
            </Label>
            <Input
              value={value.institution_custom_name || ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  institution_id: null,
                  institution_name: e.target.value,
                  institution_custom_name: e.target.value,
                })
              }
              placeholder="Nome completo da instituição"
              disabled={disabled}
              className="mt-1"
            />
          </div>
          <div>
            <Label>
              Sigla <span className="text-destructive">*</span>
            </Label>
            <Input
              value={customSigla}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().replace(/[^A-ZÀ-Ú0-9]/g, "").slice(0, 10);
                setCustomSigla(val);
                onChange({
                  ...value,
                  institution_id: null,
                  institution_sigla: val || null,
                });
              }}
              placeholder="Ex: UFMG, USP, SENAI"
              disabled={disabled}
              className="mt-1 uppercase"
              maxLength={10}
            />
            {customSigla.length > 0 && !siglaValid && (
              <p className="text-xs text-destructive mt-1">A sigla deve ter entre 2 e 10 caracteres.</p>
            )}
          </div>
          <div>
            <Label>
              Tipo de instituição <span className="text-destructive">*</span>
            </Label>
            <select
              value={value.institution_type || ""}
              onChange={(e) =>
                onChange({
                  ...value,
                  institution_type: e.target.value || null,
                })
              }
              disabled={disabled}
              className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="">Selecione o tipo</option>
              {INSTITUTION_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        </div>
      )}
    </div>
  );
};

export default InstitutionSelector;
