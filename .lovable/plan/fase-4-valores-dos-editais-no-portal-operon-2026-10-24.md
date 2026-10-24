# Fase 4: Valores dos editais no portal Operon

Hoje as cinco colunas de valor existem em `oe_edital` e estão vazias. O tipo local do projeto ainda não as conhece; elas entram no tipo do módulo Operon, como já feito com abrangência e TL;DR. Nenhum dado de exemplo será criado.

## Regra central (um único lugar)
Novo `src/lib/operon-valores.ts`, funções puras usadas por todas as telas:
- `situacaoValor(e)`: `confirmado` (tipo total ou estimado, valor preenchido, `valor_confirmado_em` preenchido), `por_agencia`, `nao_confirmado` (tem valor ou tipo, sem confirmação), `sem_valor` (nada preenchido ou `nao_informado`).
- `rotuloValor(e)`: "Total", "Estimado", "Por agência", "Sem valor"; texto "Valor não informado" no vazio; "Aguardando confirmação" quando não confirmado.
- `fmtReais`: R$ com `Intl` pt-BR.
- `resumoValores(lista)`: soma apenas `confirmado`, separando Total e Estimado; devolve contagens e listas de `sem_valor`, `nao_confirmado` e `por_agencia`, que nunca entram em soma.
- `valoresPorAgencia`, `valoresPorMes` (mês pela regra existente `dataPublicacaoInfo`, preservando a marca de data aproximada), `valoresPorTipo`.

## Etapas para aprovação uma a uma

### Etapa A: exibição (somente leitura)
- Tabela de Chamadas: ativar a coluna Valor já reservada, mostrando valor formatado e selo de tipo; vazio = "Valor não informado". Cartões no celular idem.
- Drawer e ficha `/editais/:id`: bloco "Valor" com valor, tipo, observação integral e data de confirmação; aviso "Aguardando confirmação da curadoria" quando não confirmado.
- CSV: colunas Valor (R$), Tipo de valor, Situação do valor, Observação do valor.
- Arquivos: `operon-valores.ts` (novo), `operon-portal.ts` (seleção das colunas e tipo), `operon-chamadas.ts` (CSV e ordenação por valor), `ChamadasTabela.tsx`, `ChamadasCartoes.tsx`, `EditalDrawer.tsx`, `EditalFichaPage.tsx`.

### Etapa B: página "Valores" e cartão na Visão geral
- Novo item de menu "Valores" (`/editais/valores`) para todos os usuários.
- Topo: total confirmado, sempre ao lado das contagens "Sem valor informado", "Valor não confirmado" e "Por agência", cada uma clicável abrindo Chamadas filtrada.
- Gráficos de barras (recharts já existente): por agência, por mês de lançamento, por tipo (Total x Estimado). Somente valores confirmados, legenda explícita "Somente valores confirmados pela curadoria".
- Listas abaixo: editais sem valor, não confirmados e por agência, com link para a ficha.
- Com zero valores: estado vazio explicando que os valores chegam após coleta e confirmação, mostrando apenas as contagens.
- Visão geral: um cartão "Valor confirmado" com a mesma regra e link para Valores.
- Filtro novo em Chamadas: "Situação do valor".
- Arquivos: `ValoresPage.tsx` (novo), `OperonSidebar.tsx`, `App.tsx` (rota aninhada), `VisaoGeralPage.tsx`, `ChamadasPage.tsx`, `operon-chamadas.ts` (filtro e chip).

### Etapa C: confirmação na Curadoria (somente icca_admin)
- Em `EditalCuradoriaDetail.tsx`, seção "Valor do edital": campo em R$, seletor de tipo (sentinela `__none__`), observação, botões "Salvar sem confirmar" e "Confirmar valor".
- Confirmar grava `valor_confirmado_em = agora` e `valor_confirmado_por = id do usuário logado` (obtido da sessão, não digitado). Alterar valor, tipo ou observação de um valor já confirmado limpa a confirmação até nova confirmação, com aviso.
- Validação: valor maior que zero exigido para Total e Estimado; vazio para Sem valor; Por agência aceita vazio.
- Usa o fluxo de alterações não salvas e atualização otimista que a curadoria já tem; toasts de sucesso e erro.
- Ver como: botões desativados com aviso "Modo visualização"; o guarda de rede global continua bloqueando a gravação.
- Arquivos: `EditalCuradoriaDetail.tsx`, `operon-valores.ts` (validação e montagem do payload).

### Etapa D: calendário e CSV
- O calendário mensal de Prazos já existe. Ajustes: respeitar os filtros ativos de Chamadas (fonte, esfera, abrangência), mostrar valor confirmado no item quando houver, e botão "Exportar CSV" da lista do mês.
- Exportação de Chamadas já existe; passa a incluir as colunas de valor (Etapa A).
- Arquivos: `PrazosPage.tsx`.

## Proteção da escrita (RLS atual)
O que já cobre:
- `oe_edital_curador_escreve` (todas as operações) exige `oe_is_curador()`; quem não é curador não grava nada.
- `oe_edital_publico` mostra ao portal só editais publicados, então valores de rascunhos não vazam.

O que faltaria (somente lista, nada será criado):
1. A policy permite ao curador gravar qualquer `valor_confirmado_por`; um gatilho deveria forçar `auth.uid()` e `now()` quando a confirmação é gravada.
2. Não há validação no banco de `valor_tipo` nos quatro valores nem de valor não negativo; sugerido gatilho de validação (padrão do projeto, sem CHECK).
3. Limpar a confirmação automaticamente quando valor, tipo ou observação mudam também deveria ficar no gatilho, não só na tela.
4. Opcional: registrar a confirmação em `audit_logs`.
5. A interface restringe a icca_admin; o banco usa `oe_is_curador()`. Se os dois conceitos divergirem, o banco é quem decide.

Nenhuma RPC nova é necessária: todos os cálculos são feitos no navegador sobre os editais publicados já carregados.

## Testes propostos (vitest)
- `operon-valores.test.ts`: classificação dos quatro estados; soma ignora não confirmados, por agência e sem valor; Total e Estimado separados; agrupamento por mês usa a data da agência e marca data aproximada; lista vazia devolve zero e contagens corretas; formatação em reais.
- Tabela e drawer: "Valor não informado" no vazio; rótulo de tipo e observação.
- CSV: colunas de valor presentes e vazias corretamente.
- Curadoria: payload de confirmação contém só os cinco campos de valor e o id da sessão; edição limpa a confirmação; validação por tipo; botões bloqueados no Ver como; seção oculta para quem não é icca_admin.
- Calendário: respeita filtros e exporta o mês.

## Riscos
- Tipos locais do Operon precisam incluir as colunas novas; risco de divergência se o banco mudar nomes.
- Valores numeric chegam como texto ou número dependendo do cliente; conversão centralizada em `operon-valores.ts`.
- Sem os gatilhos acima, a integridade de `valor_confirmado_por` depende da interface.
- Com poucos valores, gráficos ficam vazios por bastante tempo; por isso as contagens de pendentes ficam sempre visíveis.
- Volume atual é pequeno; cálculo no cliente é suficiente. Se passar de alguns milhares de editais, mover agregados para uma RPC.
