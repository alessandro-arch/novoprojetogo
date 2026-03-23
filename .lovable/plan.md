

## Plan: Remove Institutional References from Fomento Module

Purely text/label changes across 5 files. No functionality, routes, or database changes.

### Changes

**1. `src/pages/Index.tsx`** (line 18)
- Remove `badge: "PRPPGE · UVV"` from the Fomento card
- Description already says "Monitoramento de captação de recursos e termos de outorga" — no change needed

**2. `src/pages/fomento/FomentoLogin.tsx`** (lines 78-82)
- Remove the `<Badge>PRPPGE · UVV</Badge>` block
- Change subtitle (line ~87) to: "Monitore e gerencie a captação de recursos da sua instituição"

**3. `src/pages/fomento/FomentoPanel.tsx`** (line 94)
- Change `subtitle="PRPPGE · UVV"` → `subtitle="Gestão de Captação de Recursos"`

**4. `src/components/fomento/FomentoProjectForm.tsx`**
- Line 415: Change label `"Processo UVV"` → `"Processo Interno"`
- Line 464: Remove placeholder `"PPG em Biotecnologia Vegetal (UENF-UVV)"` → empty or `"Ex: PPG em Ciências Ambientais"`

**5. `src/components/fomento/FomentoProjectsList.tsx`**
- Line 64 (CSV header): `"Processo UVV"` → `"Processo Interno"`
- Line 146 (table header): `"Processo UVV"` → `"Processo Interno"`

### Not changed
- Database column `processo_uvv` stays as-is (plan says no DB changes)
- Variable names `processo_uvv` / `setProcessoUvv` stay (internal, not user-facing)
- `supabase/functions/seed-cnpq-areas` — "Biotecnologia Vegetal" is a CNPq area name, not institutional
- No existing `@uvv.br` placeholders found in the code
- ProjetoGO original pages untouched

