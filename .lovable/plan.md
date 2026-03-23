

## Plan: Update [C] Classificação Fields

### Summary
Update the classification section in the Fomento project form, database validation trigger, and all label maps/dashboard references.

### Step 1: Database Migration
Update the `validate_fomento_projects()` trigger function (no CHECK constraints — project uses triggers):

```sql
CREATE OR REPLACE FUNCTION public.validate_fomento_projects()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.fonte IS NOT NULL AND NEW.fonte NOT IN ('publica','privada') THEN
    RAISE EXCEPTION 'fonte must be publica, privada, or NULL';
  END IF;
  IF NEW.natureza IS NOT NULL AND NEW.natureza NOT IN ('auxilio_financeiro','bolsa') THEN
    RAISE EXCEPTION 'natureza must be auxilio_financeiro, bolsa, or NULL';
  END IF;
  IF NEW.area IS NOT NULL AND NEW.area NOT IN ('pesquisa','inovacao','extensao','ensino','servicos') THEN
    RAISE EXCEPTION 'area must be pesquisa, inovacao, extensao, ensino, servicos, or NULL';
  END IF;
  IF NEW.vinculo_academico IS NOT NULL AND NEW.vinculo_academico NOT IN ('ppg','graduacao','nenhum') THEN
    RAISE EXCEPTION 'vinculo_academico must be ppg, graduacao, nenhum, or NULL';
  END IF;
  -- status unchanged
  IF NEW.status IS NOT NULL AND NEW.status NOT IN ('em_execucao','concluido','prestacao_contas','inadimplente') THEN
    RAISE EXCEPTION 'status must be em_execucao, concluido, prestacao_contas, inadimplente, or NULL';
  END IF;
  RETURN NEW;
END;$$;
```

Also migrate existing data: `UPDATE fomento_projects SET natureza = NULL WHERE natureza IN ('outorga','parceria');` and `UPDATE fomento_projects SET vinculo_academico = NULL WHERE vinculo_academico = 'ambos';`

### Step 2: Update `fomento-utils.ts`
- Rename no label needed for `FONTE_LABELS` (values unchanged)
- Add `NATUREZA_LABELS`: `{ auxilio_financeiro: "Auxílio Financeiro", bolsa: "Bolsa" }`
- Update `AREA_LABELS`: add `ensino: "Ensino"`
- Add `VINCULO_LABELS`: `{ ppg: "Programa de Pós-Graduação", graduacao: "Graduação", nenhum: "Nenhum" }`

### Step 3: Update `FomentoProjectForm.tsx` — Section [C]
- Label "Fonte" → "Origem do Recurso"
- Natureza radio: replace `outorga/parceria` with `auxilio_financeiro/bolsa` ("Auxílio Financeiro" / "Bolsa")
- Area radio: add `ensino` option between `extensao` and `servicos`
- Vínculo radio: remove `ambos`, rename "PPG" display to "Programa de Pós-Graduação"
- PPG nome conditional: show only when `vinculo_academico === "ppg"` (remove `ambos` check)
- Save payload ppg_nome: only when `vinculo_academico === "ppg"`
- AI prompt: update natureza hint from `"outorga ou parceria"` to `"auxilio_financeiro ou bolsa"`

### Step 4: Update `FomentoProjectsList.tsx`
- The list already uses `AREA_LABELS` and `FONTE_LABELS` from utils — no changes needed since labels auto-update

### Step 5: Update `FomentoDashboardView.tsx`
- Area breakdown array: add `"ensino"` to the list `["pesquisa","inovacao","extensao","ensino","servicos"]`

### Files Modified
- `supabase/migrations/` — new migration
- `src/lib/fomento-utils.ts`
- `src/components/fomento/FomentoProjectForm.tsx`
- `src/components/fomento/FomentoDashboardView.tsx`

