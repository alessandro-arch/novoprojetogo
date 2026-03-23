

## Problem

The [G] Documentos section only appears when editing an existing project (`isEditing && projectId`). On the "Novo Projeto" form (`/fomento/projetos/novo`), there is no `projectId` yet, so documents cannot be uploaded — the section is hidden.

This is technically correct: documents require a saved project to attach to. But the UX is confusing because the user expects to see all sections.

## Proposed Solution

Show the [G] Documentos section on the new project form as well, but in a disabled/informational state with a message like: "Salve o projeto primeiro para anexar documentos." This way the section is visible and the user understands they need to save first.

### Changes

**File: `src/components/fomento/FomentoProjectForm.tsx`**
- Remove the `isEditing && projectId` guard on the documents section
- When `projectId` is not available, show a placeholder message instead of `FomentoDocumentsSection`

```text
Before:
  {isEditing && projectId && (
    <SectionCard ...>
      <FomentoDocumentsSection projectId={projectId} />
    </SectionCard>
  )}

After:
  <SectionCard ...>
    {projectId ? (
      <FomentoDocumentsSection projectId={projectId} />
    ) : (
      <p class="text-sm text-muted-foreground text-center py-6">
        Salve o projeto primeiro para anexar documentos.
      </p>
    )}
  </SectionCard>
```

### Technical Details
- Single file change: `FomentoProjectForm.tsx` (lines 619-624)
- No database or backend changes needed

