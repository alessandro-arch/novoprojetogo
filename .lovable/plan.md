

## Plano: Novo Módulo "Parcerias" no Fomento

### Resumo
Criar um módulo completo de Parcerias no painel Fomento, com tabela no banco de dados, listagem com filtros/KPIs, e formulário de cadastro/edição.

---

### 1. Migração de Banco de Dados

Criar tabela `fomento_parcerias` com os campos:

| Coluna | Tipo | Notas |
|---|---|---|
| id | uuid PK | gen_random_uuid() |
| organization_id | uuid | FK para fomento_organizations, nullable |
| numero_contrato | text | Número do Contrato/Processo |
| titulo | text NOT NULL | Título da Parceria |
| tipo | text | Contrato, Convênio, Acordo de Cooperação, Termo de Fomento |
| status | text | em_negociacao, ativa, encerrada, suspensa |
| instituicao_nome | text | Nome da Instituição Parceira |
| cnpj | text | Com máscara no front |
| tipo_instituicao | text | publica_federal, publica_estadual, privada, internacional |
| num_beneficiarios | integer | default 0 |
| num_parcelas | integer | default 0 |
| valor_mensal_aluno | numeric | default 0 |
| valor_total | numeric | Calculado no front (benef × parcelas × valor_mensal) |
| created_by | uuid | nullable |
| created_at | timestamptz | default now() |
| updated_at | timestamptz | default now() |

RLS: mesmas policies do padrão fomento (`has_fomento_access` para select/insert/update, `has_fomento_admin` para delete).

Trigger `update_updated_at_column` no update.

Trigger de validação para tipo e status.

---

### 2. Menu Principal (FomentoPanel.tsx)

- Adicionar item "Parcerias" com ícone `Handshake` entre "Alertas de Vigência" e "Administração"
- Roteamento: `/fomento/parcerias`, `/fomento/parcerias/nova`, `/fomento/parcerias/:id/editar`

---

### 3. Componente de Listagem: `FomentoParceirasList.tsx`

- **KPI Cards no topo**: Total de parcerias ativas, Valor total captado (soma valor_total das ativas), Número total de beneficiários (soma das ativas)
- **Filtros**: Select por Status e Select por Tipo
- **Tabela**: Número contrato, Título, Tipo, Instituição, Beneficiários, Valor Total, Status (badge colorido)
- Botões: Nova Parceria, Editar, Excluir (admin)

Badges de status:
- em_negociacao → amarelo
- ativa → verde
- encerrada → cinza
- suspensa → vermelho

---

### 4. Componente de Formulário: `FomentoParceiraForm.tsx`

Três seções colapsáveis (padrão SectionCard existente):

**[A] Identificação**: Número do Contrato, Título, Tipo (select), Status (select)

**[B] Instituição Parceira**: Nome, CNPJ (máscara XX.XXX.XXX/XXXX-XX), Tipo da Instituição (select)

**[C] Financeiro**: Nº beneficiários, Nº parcelas, Valor mensal por aluno (input moeda), Valor total (calculado automaticamente, read-only)

---

### 5. Utilitários (fomento-utils.ts)

Adicionar labels:
```typescript
PARCERIA_TIPO_LABELS, PARCERIA_STATUS_LABELS, TIPO_INSTITUICAO_LABELS
```

---

### Detalhes Técnicos

- A tabela usa `organization_id` para isolamento multi-tenant (mesmo padrão das demais tabelas fomento)
- O campo `valor_total` é calculado no frontend antes do save: `num_beneficiarios * num_parcelas * valor_mensal_aluno`
- Máscara de CNPJ aplicada via handler de onChange no input
- Queries seguem o padrão existente com `@tanstack/react-query` e filtro por `fomentoOrgId`

