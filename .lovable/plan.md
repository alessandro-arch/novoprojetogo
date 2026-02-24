

# Refatoracao Mobile-First -- ProjetoGO (Todas as Paginas)

## Diagnostico Atual

Apos analise completa do codigo, o sistema ja possui uma base mobile razoavel:
- `PanelLayout` ja implementa Drawer hamburger + Header sticky em telas < 768px
- `MinhasPropostas` ja usa tabela no desktop e cards empilhados no mobile
- `EditaisAbertos` e `SubmissionsList` ja usam cards responsivos
- Inputs ja usam `text-base` (16px) no mobile via classe do Shadcn

**Gaps identificados que precisam correcao:**

| Componente | Problema |
|---|---|
| `OrgDashboard` | KPI cards usam `grid-cols-2` em mobile -- pode comprimir demais em telas < 380px |
| `AuditLogViewer` | Tabela de 6 colunas sem scroll horizontal nem versao card no mobile |
| `SubmissionsList` (detalhe) | Botoes de acao empilhados sem touch targets adequados |
| `EditaisList` | Filtros nao ocupam 100% da largura no mobile |
| `ReviewForm` | Slider + score display pode ficar apertado em telas pequenas |
| `AuditLogViewer` | Header com titulo + botoes de export nao empilha no mobile |
| Varios componentes | Botoes de acao menores que 44px de altura |

---

## Plano de Implementacao

### 1. OrgDashboard -- KPI Cards Responsivos
- Alterar grid de `grid-cols-2 lg:grid-cols-4` para `grid-cols-1 sm:grid-cols-2 lg:grid-cols-4`
- Cards empilham em telas muito pequenas, 2 colunas em smartphones maiores

### 2. AuditLogViewer -- Mobile-First com Scroll Horizontal + Responsividade
- Header: empilhar titulo e botoes de export verticalmente no mobile (`flex-col sm:flex-row`)
- Filtros: cada select ocupa 100% da largura no mobile (`w-full sm:w-[180px]`)
- Tabela: envolver em `div` com `overflow-x-auto` e `-webkit-overflow-scrolling: touch`
- Fixar coluna "Data/Hora" com `sticky left-0` para manter referencia durante scroll
- Paginacao: empilhar no mobile

### 3. SubmissionsList (Detalhe) -- Touch Targets e Layout
- Botoes de acao: garantir `min-h-[44px]` em todos os botoes
- Layout dos botoes: usar grid em vez de flex-wrap para melhor distribuicao no mobile
- Tabs: usar `w-full` no TabsList em mobile

### 4. EditaisList -- Filtros Full-Width
- Filtros ja usam `w-full sm:w-48` -- verificar consistencia
- Botao "Novo Edital": `w-full sm:w-auto` no mobile para facilitar toque
- Cards de edital: garantir que badges nao quebrem para fora do card (usar `flex-wrap`)

### 5. ReviewForm -- Ajustes de Slider e Score
- Score display: reorganizar em coluna no mobile (`flex-col sm:flex-row`)
- Botao "Enviar Avaliacao": `w-full` no mobile com `min-h-[48px]`
- Aumentar area de toque do Slider

### 6. PanelLayout -- Ajustes Finos
- Garantir `min-h-[44px]` nos botoes de navegacao da sidebar (ja presente)
- Verificar que botoes de footer (Sair, Meu Cadastro) tem area de toque adequada (ja presente)

### 7. Componentes UI Globais -- Touch e Feedback
- `Button`: classe `btn-press` ja aplica `active:scale-95` -- verificar se funciona no touch
- Adicionar `touch-action: manipulation` nos botoes para eliminar delay de 300ms no iOS
- Classe utilitaria `.touch-target` com `min-h-[44px] min-w-[44px]` para reutilizacao

### 8. index.css -- Utilitarios Globais Mobile
- Adicionar classe `.mobile-scroll` para scroll horizontal suave em tabelas
- Regra CSS para remover hover effects em dispositivos touch (`@media (hover: none)`)
- Manter `prefers-reduced-motion` ja implementado

---

## Detalhes Tecnicos

### Arquivos a Modificar

1. **src/components/org/OrgDashboard.tsx** -- grid responsivo nos KPI cards
2. **src/components/org/AuditLogViewer.tsx** -- header responsivo, filtros full-width, tabela com scroll horizontal, paginacao empilhada
3. **src/components/org/SubmissionsList.tsx** -- touch targets nos botoes de acao, tabs responsivas
4. **src/components/org/EditaisList.tsx** -- botao novo edital full-width no mobile, filtros consistentes
5. **src/components/reviewer/ReviewForm.tsx** -- score layout responsivo, botao submit full-width
6. **src/index.css** -- utilitarios touch-action, mobile-scroll, hover:none media query
7. **src/components/ui/button.tsx** -- adicionar `touch-action-manipulation` na classe base

### Nenhuma Nova Dependencia Necessaria

Todas as alteracoes usam Tailwind CSS existente e CSS nativo.

