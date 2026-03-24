

## Plano: Novo Papel de Acesso — Auditor (Read-Only)

### Resumo
Adicionar o papel **auditor** ao módulo Fomento com acesso somente leitura. Auditores podem ver tudo (dashboard, projetos, bolsistas, parcerias, alertas, documentos) mas não podem criar, editar ou excluir nada. Apenas admin/superadmin podem convidar e remover auditores.

---

### 1. Migração SQL — Banco de Dados

**a) Atualizar `has_fomento_access`** para incluir `'auditor'` (já funciona — aceita qualquer `fomento_role IS NOT NULL`, então o auditor já tem SELECT via RLS automaticamente).

**b) Criar função `has_fomento_write_access`** que exclui auditores:
```sql
CREATE OR REPLACE FUNCTION public.has_fomento_write_access(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE user_id = _user_id
      AND fomento_role IN ('superadmin', 'admin', 'gestor')
  )
$$;
```

**c) Atualizar políticas RLS de INSERT/UPDATE/DELETE** em todas as tabelas fomento para usar `has_fomento_write_access` em vez de `has_fomento_access`:
- `fomento_projects` → INSERT, UPDATE usam `has_fomento_write_access`
- `fomento_bolsistas` → INSERT, UPDATE usam `has_fomento_write_access`
- `fomento_parcerias` → INSERT, UPDATE usam `has_fomento_write_access`
- `fomento_documents` → INSERT usa `has_fomento_write_access`
- `fomento_rubricas` → DROP policy `fomento_rubricas_all`, criar SELECT com `has_fomento_access` e INSERT/UPDATE/DELETE com `has_fomento_write_access`
- `fomento_team` → DROP policy `fomento_team_all`, criar SELECT com `has_fomento_access` e INSERT/UPDATE/DELETE com `has_fomento_write_access`
- Storage `fomento-docs` → INSERT e DELETE usam `has_fomento_write_access`; SELECT mantém `has_fomento_access`

**d) Atualizar `set_fomento_role`** para aceitar `'auditor'` como valor válido.

**e) `fomento_invite_log`** — manter sem acesso para auditor (já controlado por `has_fomento_admin`).

---

### 2. Frontend — FomentoPanel.tsx (Rotas e Navegação)

- Auditor **não vê** o item "Administração" no menu lateral (já controlado: `fomentoRole === "admin" || isSuperadmin`)
- Se auditor tentar acessar `/fomento/admin` manualmente → redirecionar para `/fomento/dashboard` com toast "Acesso restrito"
- Adicionar helper `isAuditor = fomentoRole === 'auditor'` no contexto `FomentoAuthContext`

---

### 3. Frontend — Componentes de Lista (modo read-only)

Em **FomentoProjectsList**, **FomentoBolsistasList**, **FomentoParceirasList**:
- Ocultar botões "Novo", "Importar em Lote", "Editar", "Excluir" quando `fomentoRole === 'auditor'`
- Manter botões de download visíveis

Em **FomentoDashboardView**:
- Ocultar botão de edição (lápis) nos projetos quando auditor

Em **FomentoAlerts**:
- Manter visualização; ocultar ações de edição se existirem

---

### 4. Frontend — FomentoAdmin.tsx (Convite de Auditor)

- Adicionar `{ value: "auditor", label: "Auditor" }` na lista `availableRoles` para admin e superadmin
- Badge do auditor: cor âmbar `bg-[#EF9F27]/15 text-[#EF9F27]` com label "Auditor"
- Atualizar `ROLE_LABELS` com `auditor: "Auditor"`

---

### 5. Frontend — Banner Read-Only para Auditor

No **PanelLayout** ou **FomentoPanel**, quando `fomentoRole === 'auditor'`:
- Exibir banner sutil no topo do conteúdo: "🔒 Você está em modo somente leitura"
- Estilo: fundo âmbar claro, texto âmbar escuro, ícone de cadeado

---

### 6. Frontend — Tooltips nos Botões Desabilitados

Para botões que ficam desabilitados para auditor, adicionar tooltip: "Seu perfil não possui permissão para esta ação"

---

### Arquivos Modificados

| Arquivo | Alteração |
|---|---|
| Nova migração SQL | Criar `has_fomento_write_access`, atualizar RLS policies |
| `src/contexts/FomentoAuthContext.tsx` | Adicionar `isAuditor` ao contexto |
| `src/pages/fomento/FomentoPanel.tsx` | Guard de rota admin, banner read-only |
| `src/components/fomento/FomentoAdmin.tsx` | Role auditor no convite, badge âmbar |
| `src/components/fomento/FomentoProjectsList.tsx` | Ocultar ações para auditor |
| `src/components/fomento/FomentoBolsistasList.tsx` | Ocultar ações para auditor |
| `src/components/fomento/FomentoParceirasList.tsx` | Ocultar ações para auditor |
| `src/components/fomento/FomentoDashboardView.tsx` | Ocultar botão editar para auditor |

