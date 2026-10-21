# Operon Editais, etapa 1: fila de curadoria (plano revisado, mínimo)

## Confirmado no banco
- As 6 tabelas `oe_*` existem com as colunas descritas. RLS: curadores (`oe_is_curador()`) leem tudo e escrevem; demais só leem publicados; `oe_extracao` só curadores; `oe_fonte` leitura aberta.
- O arquivo de tipos gerado do Supabase ainda não tem as tabelas `oe_*`. Não será editado: as consultas usam um cast pontual do cliente existente, dentro dos arquivos novos.

## Arquivos (4 no total)

| Arquivo | Situação | Conteúdo |
|---|---|---|
| `src/pages/editais/CuradoriaPage.tsx` | Novo | Topo (título, contadores, filtros, frase fixa), lista, seleção, consultas e mutações React Query, tipos locais e a função de rodada vigente |
| `src/components/operon/EditalCuradoriaDetail.tsx` | Novo | Detalhe: cabeçalho, campos editáveis com valor extraído, rodadas, documentos, linha do tempo e ações |
| `src/App.tsx` | Alterado | Só 1 import e 1 linha de rota `/editais/curadoria` com `ProtectedRoute allowedRoles={["icca_admin"]}` |
| `src/pages/admin/AdminPanel.tsx` | Alterado | Só 1 botão-link "Operon Editais" no cabeçalho, no mesmo padrão do botão "Cadastro" já existente |

Dispensados do plano anterior: arquivo de tipos, utilitário de datas, arquivo de queries, componentes de item, campo, rodadas, documentos, eventos, estado de lista e o arquivo de teste. Nenhum token, cor, fonte, sombra ou raio novo.

## O que será reutilizado
- Layout e estilo: mesmo padrão do `AdminPanel` (header com `border-b bg-card`, `container mx-auto`, cartões `bg-card rounded-xl border`), só classes semânticas já usadas.
- Componentes shadcn existentes: `Card`, `Badge` (selos de fonte, situação, confiança, "Sem número", "Carga inicial", retificação/errata/adendo), `Button`, `Select` (com sentinela `__none__` para "Todos"), `Input`, `Textarea`, `Label`, `Skeleton` (carregando), `AlertDialog` (confirmação de descartar), `ScrollArea` (lista).
- `KpiCard` e `Placeholder` de `src/components/servicedesk/sd-ui.tsx` para os contadores e para os estados vazio/erro (com botão "Tentar novamente").
- `useAuth` (id do curador), `useToast` (feedback), `useIsMobile` (no celular, lista e detalhe alternam com "Voltar à lista"), cliente `supabase` existente e React Query.
- Datas: `formatDateBR` de `fomento-utils` usa o fuso do navegador, então não atende "horário de Brasília". Uso `toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })` direto, numa função de 3 linhas dentro da página, sem arquivo novo.

## Acesso aos dados
- `oe_fonte`: `id, slug, nome` para o filtro FAPES/CNPq.
- Lista: `oe_edital` filtrado no servidor por status (padrão rascunho), ano (padrão 2026), situação e fonte, com `oe_fonte(slug,nome)` e `oe_rodada(ordem,abertura,prazo_fim)` embutidos. Ordenação no cliente: prazo da rodada vigente mais próximo, depois `visto_ultima_vez_em` desc. Rodada vigente: em andamento hoje; senão a próxima futura; senão a última.
- Contadores: 3 contagens `head: true` (rascunho, em revisão, publicado) com os mesmos filtros de fonte, ano e situação.
- Detalhe: consultas por `edital_id` em `oe_rodada` (ordem asc), `oe_documento`, `oe_evento` (ocorrido_em desc) e `oe_extracao` dos campos objetivo, recursos, quem_pode, contrapartida, areas.
- Aprovar e publicar: atualiza campos + `status_curadoria='publicado'`, `verificado_em`, `verificado_por=auth.uid()`; depois marca cada extração `aprovado` (valor igual ao extraído) ou `editado` (diferente), com `revisado_por` e `revisado_em`. `oe_evento.liberado` não é tocado.
- Salvar como em revisão: campos + `status_curadoria='em_revisao'`.
- Descartar: confirmação e `status_curadoria='descartado'`. Nunca apaga linhas.

## Estados
- Carregando: `Skeleton` em lista, contadores e cada bloco do detalhe.
- Vazio: `Placeholder` ("Nenhum edital com esses filtros", "Datas ainda não extraídas", "Nenhum documento", "Nenhum evento", "Selecione um edital para revisar").
- Erro: `Placeholder` com a mensagem e botão "Tentar novamente".
- Ações: botões desabilitados durante a gravação, Toast de sucesso ou erro.

## Ao final
Listarei os arquivos criados e alterados e confirmarei que nenhum arquivo de autenticação, rota existente ou tabela foi modificado além da nova rota e do link de menu.
