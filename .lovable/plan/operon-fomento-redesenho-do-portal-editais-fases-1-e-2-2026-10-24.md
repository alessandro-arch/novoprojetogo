# Operon Fomento: redesenho do portal (/editais), fases 1 e 2

Pré-requisito: o pedido anterior (menu de perfil com acesso à Curadoria) já está concluído; o novo layout reaproveita o `OperonUserMenu` sem mudanças de regra.

## Fase 1: navegação e lista

**Layout com menu lateral** (componente `Sidebar` do shadcn, já presente no projeto; vira gaveta no celular). Os itens ficam em sub-rotas sob `/editais`, todas com o login e o controle de acesso do Operon:
- Visão geral: `/editais` (página inicial)
- Chamadas: `/editais/chamadas`
- Prazos: `/editais/prazos` (calendário mensal simples, montado com a grade do `Calendar` já existente)
- Meus alertas: `/editais/alertas`
- Fontes: `/editais/fontes` (fontes institucionais, esfera e quantidade de editais publicados)
- Curadoria e Saúde das coletas: aparecem só para quem tem `icca_admin` efetivo, com a mesma regra do menu do usuário. No Ver como, somem quando o papel simulado não é `icca_admin`.
- A ficha `/editais/:id` continua igual, dentro do mesmo layout. A rota `chamadas` é declarada antes de `:id`.

**Meus alertas** sai do topo e vira página própria: Telegram (`TelegramAlertas` sem mudanças: aviso de conta, expiração e bloqueio no Ver como), e-mail como canal padrão e a lista dos editais seguidos, com o botão Seguir.

**Chamadas**
- Busca sem acento, abas com contagem (Abertos, Em julgamento, Resultados) e filtros Fonte, Esfera, Abrangência e Situação reunidos numa barra só.
- Chips dos filtros ativos, cada um com X, e botão "Limpar tudo".
- Filtros salvos em localStorage com try/catch. A chave inclui o id do usuário, para não misturar contas.
- Ordenação clicável por prazo, data de publicação e fonte (crescente e decrescente, com `aria-sort`).
- Linhas compactas: um selo de fonte, um de situação e a abrangência. A restrição para IES vira um ícone de alerta com tooltip acessível pelo teclado e um texto só para leitor de tela.
- Botão Seguir em cada linha (reaproveita o `SeguirEditalButton` em versão compacta, bloqueado no Ver como).
- Clicar na linha abre um painel lateral (`Sheet`) com TL;DR, prazos, rodadas e link oficial, além de "Ver ficha completa".
- Exportar CSV da lista filtrada e ordenada, gerado no navegador (UTF-8 com BOM e separador `;`, para o Excel em português). Exportar não grava nada e continua permitido no Ver como.
- Coluna Valor já definida no código, mas escondida enquanto nenhum edital tiver valor (fica para a fase 3).
- No celular, a tabela vira cartões.

## Fase 2: Visão geral (todos os usuários do portal)

Tudo é calculado no navegador a partir dos editais publicados que o portal já carrega. Não há consulta nova. "Hoje" usa o horário de Brasília. A situação vem da regra central por rodadas.

| Indicador | Cálculo | Ao clicar |
|---|---|---|
| Abertos agora | situação derivada = aberto | Chamadas?aba=abertos |
| Encerram em 7 dias | abertos com próximo prazo_fim entre hoje e hoje + 7 | Chamadas?prazo=7d |
| Lançados nos últimos 30 dias | data de publicação (`verificado_em`, ou `data_publicacao` como alternativa) nos últimos 30 dias | Chamadas?publicados=30d |
| Em julgamento | situação derivada = em julgamento | Chamadas?aba=em_julgamento |

Gráficos (recharts com `ChartContainer`, ambos já no projeto; nenhuma dependência nova; sem pizza):
- Lançamentos por mês e por agência: barras empilhadas dos últimos 12 meses, uma cor por fonte, vinda do mapa de cores das fontes.
- Abertos por fonte e abertos por esfera: barras horizontais com o valor escrito na barra.
- Prazos dos próximos 60 dias: uma linha do tempo com pontos por data de fim, agrupados por semana.
- Lista "Próximos prazos": os 5 prazos mais próximos, cada um com link para a ficha.
- Acessibilidade para daltonismo: cada gráfico tem rótulos diretos e legenda, as cores vêm dos tokens e cada barra também tem um padrão ou rótulo, sem depender só da cor. Cada gráfico tem uma tabela equivalente escondida para leitor de tela.
- Cada bloco tem seus próprios estados de carregamento, vazio e erro.

Os filtros de aprofundamento são lidos da URL pela página Chamadas, viram chips e podem ser removidos.

## Painel de usuários da Curadoria: precisa de mudança no banco (parado aqui)

Hoje cada usuário só consegue ler os próprios dados em `oe_destinatario` (`oe_destinatario_leitura_propria`). Os seguidores também são lidos só do próprio usuário. Por isso, os totais **não podem** ser calculados no navegador sem expor dados pessoais. Para este painel, seria necessária uma RPC nova, que **não será criada** sem a sua aprovação:

`oe_indicadores_usuarios()`, SECURITY DEFINER, `search_path` fixo, executada só por quem passa em `oe_is_curador()` (caso contrário, gera erro). Ela devolveria apenas números:
- usuários com acesso ao portal (perfis com organização ativa no Operon, mais os icca_admin);
- usuários com Telegram vinculado (`oe_destinatario` com canal telegram, ativo e `confirmado_em` preenchido);
- usuários com e-mail ativo;
- usuários seguindo pelo menos um edital (contagem distinta de `user_id` em `oe_seguidor_edital`);
- os 10 editais mais seguidos (id, título e contagem; nenhuma informação de usuário).

Sem essa RPC, a fase 1 e a fase 2 são entregues por completo, e o painel de usuários fica como item pendente. "Saúde das coletas" depende de dados de coleta que ainda não estão definidos (ver as perguntas).

## Arquivos

Novos:
- `src/pages/editais/OperonLayout.tsx`: menu lateral, cabeçalho com o `OperonUserMenu` e conteúdo das sub-rotas
- `src/components/operon/OperonSidebar.tsx`
- `src/pages/editais/VisaoGeralPage.tsx`, `ChamadasPage.tsx`, `PrazosPage.tsx`, `AlertasPage.tsx`, `FontesPage.tsx`
- `src/components/operon/ChamadasTabela.tsx`, `ChamadasCartoes.tsx`, `FiltrosChips.tsx`, `EditalDrawer.tsx`, `RestricaoIesIcone.tsx`
- `src/components/operon/indicadores/` com `KpiCard.tsx`, `LancamentosPorMesChart.tsx`, `AbertosPorFonteChart.tsx`, `PrazosTimeline.tsx` e `ProximosPrazos.tsx`
- `src/lib/operon-indicadores.ts`: funções puras para indicadores e séries
- `src/lib/operon-chamadas.ts`: ordenação, filtros pela URL, armazenamento seguro e CSV

Alterados:
- `src/App.tsx`: rotas aninhadas
- `src/pages/editais/EditaisPage.tsx`: vira redirecionamento ou é substituída pela Visão geral
- `src/lib/operon-portal.ts`: passa a exportar o prazo e a data de publicação usados nos cálculos
- `SeguirEditalButton.tsx`: nova variante compacta
- `AGENTS.md` e `roadmap.md`

Testes vitest:
- filtros e chips, filtros vindos da URL e armazenamento resistente a erro;
- ordenação por prazo, publicação e fonte, com vazios por último;
- cada indicador, com datas fixas;
- visibilidade de Curadoria e Saúde das coletas por papel e no Ver como;
- conteúdo do CSV;
- Seguir bloqueado no Ver como.

## Riscos de desempenho

- Hoje o portal carrega todos os editais publicados com rodadas. Isso serve até alguns milhares; acima disso, seria preciso paginar no servidor. Indicadores e filtros usam `useMemo` sobre um único cache compartilhado do React Query, então as páginas não buscam os dados de novo.
- Seguir na linha usa uma única consulta dos editais seguidos pelo usuário, e não uma por linha.
- Os gráficos são carregados só quando abertos (lazy), para não pesar a lista Chamadas.

## Perguntas em aberto

1. Aprova criar a RPC agregada `oe_indicadores_usuarios` descrita acima? Sem ela, o painel de usuários fica fora desta entrega.
2. Saúde das coletas: mostro só o link, como um item reservado, ou existe uma tabela ou log de coletas que eu deva ler?
3. "Lançados": usar `verificado_em` (publicação na curadoria) ou a data de publicação do edital pela agência?
4. Fontes: só uma página informativa, ou também um filtro rápido que leva para Chamadas?
