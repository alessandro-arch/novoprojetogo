# Operon Fomento: seção na landing e página /editais

## Arquivos
| Arquivo | Situação | Conteúdo |
|---|---|---|
| `src/components/landing/OperonFomentoSection.tsx` | Novo | Cópia do molde de `ServiceDeskSection` com fundo `bg-background`, Badge "Novo módulo", título, subtítulo, 3 destaques, cartão de funcionalidades, frase discreta da curadoria e botão `variant="dark"` "Acessar Operon Fomento" com seta para `/editais` |
| `src/pages/Index.tsx` | Alterado | 1 import e `<OperonFomentoSection />` logo após `<ServiceDeskSection />` |
| `src/pages/editais/EditaisPage.tsx` | Novo | Página somente leitura com lista e detalhe em Dialog |
| `src/App.tsx` | Alterado | 1 import e rota `/editais` com `<ProtectedRoute>` sem allowedRoles, com comentário TODO sobre plano e afiliação institucional. `/editais/curadoria` intacta |

Ícones lucide dos destaques: Radar, FileText, Bell (cartão: Search). Textos exatamente como enviados, sem travessões.

## Reutilizado
- De `CuradoriaPage.tsx` (já exportados): `oe`, `EditalRow`, `Rodada`, `fmtData`, `rodadaVigente`, `ehVigente`, `diasAte`. Nada é duplicado e a curadoria não é alterada.
- Componentes existentes: `Badge`, `Button`, `Select` (sentinela `__none__` para Todos), `Skeleton`, `Dialog` (`src/components/ui/dialog.tsx`), `Placeholder` de `sd-ui` para vazio e erro com "Tentar novamente". Cabeçalho no mesmo padrão do de curadoria, com botão "Voltar" para "/".
- React Query e o cliente supabase existente.

## Consultas (somente leitura)
- Fontes: `oe_fonte` (id, slug, nome) para o filtro.
- Lista: `oe_edital` com `.eq("status_curadoria","publicado")` e filtro de fonte opcional, embutindo `oe_fonte(slug,nome)` e `oe_rodada(ordem,abertura,prazo_fim,texto_original)`. No cliente: mantém só `ehVigente`, ordena pelo prazo da rodada vigente do mais próximo ao mais distante (sem prazo ao final).
- Detalhe (ao abrir o Dialog): `oe_documento` do edital. Campos de texto já vêm da lista. Sem eventos, sem escrita.

## Tela
- Título "Editais vigentes", frase fixa da curadoria, filtro Fonte.
- Cartão: selo da fonte, número ou "Sem número", título, categoria, prazo da rodada vigente, selo "Faltam N dias"/"Fecha hoje" (destaque até 7 dias, mesma regra da curadoria).
- Dialog: cabeçalho e "Abrir no site oficial"; Objetivo, Recursos, Quem pode participar, Contrapartida (omitidos se vazios); todas as rodadas em ordem com a vigente destacada e selo "Inscrições abrem em DD/MM/AAAA" se abertura futura; "Documentos para baixar" com rótulo, tipo e "Baixar" em nova aba, destacando retificação, errata e adendo.
- Estados: Skeleton ao carregar; erro com "Tentar novamente"; vazio com "Nenhum edital vigente publicado ainda. Os editais aparecem aqui depois da conferência da curadoria."
- Datas em horário de Brasília; layout em coluna única no celular, Dialog com rolagem.

## Ao final
Listarei os arquivos e confirmarei que nenhuma seção existente, tema, autenticação, tabela ou dependência foi modificado.
