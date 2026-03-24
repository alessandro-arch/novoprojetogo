

## Batch Import for Fomento Projects

### Overview

Add a "Importar em Lote" button to the projects list and a new batch import page at `/fomento/projetos/importar-lote`. The page allows uploading multiple PDFs, extracting data via Anthropic AI sequentially, reviewing/editing results inline, and saving selected projects in bulk.

### Files to Create

| File | Purpose |
|---|---|
| `src/components/fomento/FomentoBatchImport.tsx` | Full batch import page (~500 lines) |

### Files to Modify

| File | Change |
|---|---|
| `src/components/fomento/FomentoProjectsList.tsx` | Add "Importar em Lote" button next to "Novo Projeto" |
| `src/pages/fomento/FomentoPanel.tsx` | Add route for `importar-lote` segment, add navigation handler |

### FomentoProjectsList Changes

Add a second button with `Upload` icon labeled "Importar em Lote" that calls `onBatchImport` prop. Update the Props interface and the panel to pass the handler.

### FomentoPanel Changes

- Add `handleBatchImport` navigating to `/fomento/projetos/importar-lote`
- Pass `onBatchImport` to `FomentoProjectsList`
- Add route: `if (segments[1] === "importar-lote") return <FomentoBatchImport onBack={handleBackToProjects} />`

### FomentoBatchImport Component

**State machine with 3 phases:**

1. **Upload Phase**: API key field (from localStorage), drag-and-drop zone accepting multiple PDFs (max 20), file list with remove buttons, "Iniciar Extração" button.

2. **Processing Phase**: Sequential extraction using the same `callAnthropicApi` pattern from `FomentoProjectForm`. 3-second delay between files. Rate limit 429 → wait 20s, retry up to 3 times. Progress table showing file name, status icon (⏳/🔄/✅/⚠️/❌), extracted researcher, value, and retry button for failed items. Summary counters at the bottom.

3. **Review Phase**: Editable table with columns: #, Pesquisador, Título, Edital, Financiador, Valor Total, Área, Status IA. Row coloring: green (complete), yellow (partial), red (missing required). Checkboxes for selection. "Editar completo" button opens a Dialog with the full field set. "Salvar Selecionados (X)" button inserts checked rows into `fomento_projects` with auto-generated `processo_uvv` via RPC. Validation: pesquisador and título required. Toast on success, redirect to `/fomento/projetos`.

**AI extraction prompt**: Reuses the exact same Anthropic API call pattern and prompt from `FomentoProjectForm`, including PDF beta headers, markdown cleanup, and JSON parsing.

**Key technical details:**
- Uses the same `effectiveOrgId` resolution pattern for organization_id
- Calls `generate_fomento_processo` RPC for each saved project
- Sequential processing with `await delay(3000)` between files
- Rate limit handling: 20s wait, 3 retries, then mark as error
- Re-process individual failed files via retry button

