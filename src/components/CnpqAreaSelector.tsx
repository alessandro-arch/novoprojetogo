import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, X, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface CnpqArea {
  code: string;
  name: string;
  level: number;
  parent_code: string | null;
  full_path: string;
}

interface Props {
  value: string | null;
  onChange: (value: string) => void;
  disabled?: boolean;
  required?: boolean;
  label?: string;
}

const LEVEL_LABELS: Record<number, string> = {
  1: "Grande Área",
  2: "Área",
  3: "Subárea",
  4: "Especialidade",
};

const LEVEL_COLORS: Record<number, string> = {
  1: "bg-primary/10 text-primary border-primary/20",
  2: "bg-secondary/10 text-secondary border-secondary/20",
  3: "bg-accent text-accent-foreground border-accent",
  4: "bg-muted text-muted-foreground border-border",
};

/**
 * Reusable CNPq Knowledge Area Selector with autocomplete.
 * Queries the cnpq_areas table with debounced text search.
 */
const CnpqAreaSelector = ({ value, onChange, disabled, required, label }: Props) => {
  const [search, setSearch] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(timer);
  }, [search]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Search query
  const { data: results, isLoading } = useQuery({
    queryKey: ["cnpq-search", debouncedSearch],
    queryFn: async () => {
      if (!debouncedSearch || debouncedSearch.length < 2) {
        // Show grande áreas by default
        const { data, error } = await supabase
          .from("cnpq_areas")
          .select("*")
          .eq("level", 1)
          .order("code");
        if (error) throw error;
        return data as CnpqArea[];
      }

      const { data, error } = await supabase
        .from("cnpq_areas")
        .select("*")
        .or(`name.ilike.%${debouncedSearch}%,full_path.ilike.%${debouncedSearch}%`)
        .order("level")
        .order("code")
        .limit(30);
      if (error) throw error;
      return data as CnpqArea[];
    },
    enabled: isOpen,
  });

  // Hierarchical drill-down
  const [drillParent, setDrillParent] = useState<string | null>(null);

  const { data: children } = useQuery({
    queryKey: ["cnpq-children", drillParent],
    queryFn: async () => {
      if (!drillParent) return [];
      const { data, error } = await supabase
        .from("cnpq_areas")
        .select("*")
        .eq("parent_code", drillParent)
        .order("code");
      if (error) throw error;
      return data as CnpqArea[];
    },
    enabled: !!drillParent && isOpen,
  });

  // Selected area display
  const { data: selectedArea } = useQuery({
    queryKey: ["cnpq-selected", value],
    queryFn: async () => {
      if (!value) return null;
      // Value format: "CODE - Full Path"
      const code = value.split(" - ")[0]?.trim();
      if (!code) return null;
      const { data, error } = await supabase
        .from("cnpq_areas")
        .select("*")
        .eq("code", code)
        .maybeSingle();
      if (error) throw error;
      return data as CnpqArea | null;
    },
    enabled: !!value,
  });

  const handleSelect = useCallback((area: CnpqArea) => {
    onChange(`${area.code} - ${area.full_path}`);
    setSearch("");
    setIsOpen(false);
    setDrillParent(null);
  }, [onChange]);

  const handleDrill = useCallback((area: CnpqArea) => {
    setDrillParent(area.code);
    setSearch("");
  }, []);

  const handleClear = useCallback(() => {
    onChange("");
    setSearch("");
    setDrillParent(null);
  }, [onChange]);

  const displayItems = drillParent && !search ? children : results;

  const renderBreadcrumb = () => {
    if (!drillParent || search) return null;
    // Find the drill parent in results to show breadcrumb
    const parent = results?.find(r => r.code === drillParent) || 
      children?.find(r => r.parent_code === drillParent);
    return (
      <div className="px-3 py-2 border-b border-border flex items-center gap-1 text-xs text-muted-foreground">
        <button
          type="button"
          className="hover:text-foreground transition-colors"
          onClick={() => setDrillParent(null)}
        >
          Todas
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium truncate">
          {drillParent}
        </span>
      </div>
    );
  };

  return (
    <div ref={containerRef} className="relative">
      {label && (
        <Label className="text-sm font-medium mb-1.5 block">
          {label}
          {required && <span className="text-destructive ml-1">*</span>}
        </Label>
      )}

      {/* Selected value display */}
      {value && selectedArea ? (
        <div className="flex items-center gap-2 p-2.5 rounded-md border border-input bg-background">
          <Badge variant="outline" className={cn("text-xs shrink-0", LEVEL_COLORS[selectedArea.level])}>
            {LEVEL_LABELS[selectedArea.level]}
          </Badge>
          <span className="text-sm truncate flex-1">{selectedArea.full_path}</span>
          <span className="text-xs text-muted-foreground shrink-0">{selectedArea.code}</span>
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
            ref={inputRef}
            value={search}
            onChange={(e) => { setSearch(e.target.value); setDrillParent(null); }}
            onFocus={() => setIsOpen(true)}
            placeholder="Digite ou selecione sua área de atuação científica (CNPq)"
            className="pl-9"
            disabled={disabled}
          />
        </div>
      )}

      {/* Dropdown */}
      {isOpen && !disabled && !value && (
        <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-80 overflow-hidden animate-fade-in">
          {renderBreadcrumb()}

          <div className="overflow-y-auto max-h-72">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
            ) : !displayItems || displayItems.length === 0 ? (
              <div className="py-6 text-center text-sm text-muted-foreground">
                Nenhum resultado encontrado.
              </div>
            ) : (
              displayItems.map((area) => (
                <div
                  key={area.code}
                  className="flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 cursor-pointer transition-colors border-b border-border/50 last:border-0"
                >
                  <div className="flex-1 min-w-0" onClick={() => handleSelect(area)}>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", LEVEL_COLORS[area.level])}>
                        {LEVEL_LABELS[area.level]}
                      </Badge>
                      <span className="text-sm font-medium text-foreground truncate">{area.name}</span>
                    </div>
                    {area.level > 1 && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate pl-1">
                        {area.full_path}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="text-[10px] text-muted-foreground font-mono">{area.code}</span>
                    {area.level < 4 && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); handleDrill(area); }}
                        className="p-1 hover:bg-muted rounded transition-colors"
                        title="Expandir subitens"
                      >
                        <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CnpqAreaSelector;
