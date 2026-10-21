# Operon Editais, etapa 1: fila de curadoria

## O que foi confirmado no banco
- As 6 tabelas `oe_*` existem com as colunas descritas (mais algumas extras, como `oe_extracao.pagina`, `url_origem` e `oe_documento.hash_sha256`, que não usaremos agora).
- RLS: `oe_edital`, `oe_rodada`, `oe_documento` e `oe_evento` mostram para leitura só o que está publicado, ou tudo para curadores (`oe_is_curador()`). Escrita só para curadores. `oe_extracao` é exclusiva de curadores. `oe_fonte` é de leitura aberta.
- O arquivo de tipos gerado do Supabase ainda **não** tem as tabelas `oe_*`. Não vou editar esse arquivo: vou declarar tipos locais no módulo e chamar o cliente sem a tipagem gerada (cast pontual), só dentro dos arquivos novos.

## Arquivos

Criar:
- `src/lib/operon/types.ts`: tipos de Edital, Fonte, Rodada, Documento, Evento, Extracao e uniões de situação/status/confiança.
- `src/lib/operon/dates.ts`: formatação em `America/Sao_Paulo` (DD/MM/AAAA e DD/MM/AAAA HH:mm via `Intl.DateTimeFormat`) e `rodadaVigente(rodadas, agora)`: em andamento hoje; senão próxima futura; senão a última.
- `src/lib/operon/queries.ts`: hooks React Query (listar, detalhe, mutações).
- `src/pages/editais/CuradoriaPage.tsx`: página com topo, lista e detalhe.
- `src/components/operon/EditalListItem.tsx`, `EditalDetail.tsx`, `CampoCuradoria.tsx` (campo editável + valor extraído + trecho + selo de confiança + "Usar valor extraído"), `RodadasQuadro.tsx`, `DocumentosLista.tsx`, `EventosTimeline.tsx`, `ListState.tsx` (carregando/vazio/erro reutilizável).
- `src/test/operon-dates.test.ts`: testes da regra de rodada vigente (em andamento, próxima futura, última) e do formato de data em Brasília.

Alterar (somente inclusão):
- `src/App.tsx`: uma nova linha `<Route path="/editais/curadoria" element={<ProtectedRoute allowedRoles={["icca_admin"]}><CuradoriaPage /></ProtectedRoute>} />` e o import.
- `src/pages/admin/AdminPanel.tsx`: um botão-link "Operon Editais" no cabeçalho, ao lado de "Cadastro", nada mais.

Nada de migrações, edge functions, dependências, tema, autenticação ou outras rotas.

## Como vou consultar
- Fontes: `oe_fonte` select `id, slug, nome` (filtro FAPES/CNPq por slug).
- Lista: `oe_edital` com filtros no servidor (`status_curadoria`, `situacao`, `fonte_id`, `ano`, padrão rascunho + 2026), trazendo `oe_fonte(slug,nome)` e `oe_rodada(ordem,abertura,prazo_fim)` embutidos. A ordenação (prazo da rodada vigente mais próximo, depois `visto_ultima_vez_em` desc) é feita no cliente, pois depende da rodada vigente. Selo "Sem número" quando `numero` normalizado é `s/n`.
- Contadores: 3 consultas `count: exact, head: true` por status (rascunho, em_revisao, publicado), respeitando fonte/ano/situação.
- Detalhe: consultas paralelas por `edital_id` em `oe_edital`, `oe_rodada` (ordem asc), `oe_documento` (publicado_em desc), `oe_evento` (ocorrido_em desc), `oe_extracao` (só campos objetivo, recursos, quem_pode, contrapartida, areas; pega a mais recente por campo).
- Ações (mutações, com Toast e invalidação das queries):
  - Aprovar e publicar: atualiza o edital com os campos editados + `status_curadoria='publicado'`, `verificado_em=now`, `verificado_por=user.id`; depois atualiza cada `oe_extracao` do edital: `aprovado` se o valor final igual ao extraído, `editado` se diferente, com `revisado_por` e `revisado_em`. `oe_evento.liberado` não é tocado.
  - Salvar como em revisão: salva campos + `status_curadoria='em_revisao'`.
  - Descartar: AlertDialog de confirmação, depois `status_curadoria='descartado'`. Nunca DELETE.
- `areas` é editado como texto separado por vírgulas e gravado como array.

## Estados
- Cada lista (editais, rodadas, documentos, eventos, extrações) usa `ListState`: Skeleton ao carregar; mensagem amigável quando vazio (rodadas: "Datas ainda não extraídas"; lista: "Nenhum edital com esses filtros"); erro com mensagem e botão "Tentar novamente" (refetch).
- Detalhe sem seleção: "Selecione um edital para revisar".
- Botões de ação desabilitados e com spinner durante a gravação.

## Tela
- Topo: título "Curadoria de editais", 3 contadores, filtros (Fonte, Situação, Status, Ano) com Selects shadcn usando `__none__` como "Todos", e a frase fixa "Resumos feitos pela curadoria. Confirme no texto oficial do edital."
- Desktop: duas colunas (lista à esquerda com rolagem, detalhe à direita). Celular: lista primeiro; ao tocar, abre o detalhe em tela cheia com botão "Voltar à lista".
- Rodadas: todas em ordem, vigente destacada, selo "Inscrições abrem em DD/MM/AAAA" quando abertura futura.
- Documentos: selo de destaque para tipos retificação, errata e adendo; botão "Baixar" abre `url` em nova aba.
- Eventos: decrescente, valor anterior para novo, selo "Carga inicial" quando `origem='carga_inicial'`; somente leitura.
- Sem travessões nos textos.

## Ao final
Listarei os arquivos criados e alterados e confirmarei que nenhum arquivo de autenticação, rota existente ou tabela foi modificado.
