# Operon Fomento: IA de curadoria

## Resultado
Adicionar “Gerar com IA” na ficha da curadoria, preservando o TL;DR, a linha do tempo e os textos completos já concluídos. Login, rotas públicas, portal do usuário, tipografia e paleta permanecem intactos.

## Sugestões e revisão
- Botão disponível somente após confirmação de curador, com carregamento, opção “Sobrescrever campos já preenchidos” e saldo gratuito quando informado pelo OpenRouter.
- Preencher os campos sugeridos como alterações não salvas, destacando “Sugerido pela IA”, origem expansível e ações Aceitar/Descartar. Descartar restaura o valor anterior à sugestão; aceitar mantém o valor para gravação pelo fluxo atual.
- Aviso “Conteúdo gerado por IA, confira com o edital”. Sugestões ainda não aceitas serão bloqueadas para gravação até aceitar ou descartar, evitando confirmação implícita.
- Rodadas ficam separadas dos campos: datas editáveis para revisão e confirmação específica antes de gravar. A confirmação será uma ação explícita de gravação, sem publicar o edital, preservando rodadas existentes e evitando duplicatas.
- Atualizar a data do TL;DR quando seu conteúdo for salvo.

## Extração segura
- Criar `operon-ia-extrair`, sem gravações no banco. Validar JWT e consultar `oe_is_curador()` com o token do usuário; não curador recebe 403.
- Buscar o documento vigente de tipo edital, priorizando a versão mais recente; sem documento, usar `url_oficial`. Se o link levar a uma página em vez de PDF, retornar erro claro, sem inventar uma extração.
- Extrair PDF textual com unpdf. Limites iniciais: PDF de até 15 MB e texto de até 120 mil caracteres; rejeitar excedentes, sem cortar silenciosamente. PDF escaneado retorna “PDF sem texto extraível” sem chamar IA.
- Restringir downloads a URLs HTTPS públicas, verificar redirecionamentos, tamanho e tempo limite, impedindo acesso a endereços internos.
- Enviar o texto ao OpenRouter com temperatura 0,1, JSON e instruções científicas neutras. Validar valores, enumerações, datas e origens literais de até 300 caracteres; descartar campos inválidos. Falha ou resposta inválida tenta o modelo reserva uma única vez.
- Padrão: sugestões apenas para campos vazios ou terminados em “...” ou curtos conforme a regra solicitada. Com sobrescrita, incluir todos os campos válidos. Regras de texto curto não serão aplicadas às enumerações, para não substituir uma classificação já preenchida.
- Retornar modelo utilizado e `free_model_daily_requests` quando disponível. Tratar 429 com a mensagem solicitada. Não registrar chave nem texto integral em logs.

## Configuração necessária
`OPENROUTER_API_KEY` ainda não está configurado. Salvar pelo formulário de **Project Settings → Secrets**, nunca no chat. Obter a chave em https://openrouter.ai/settings/keys.

As três variáveis opcionais terão os padrões solicitados no código. O modelo reserva sem `:free` pode consumir créditos da conta OpenRouter; essa tentativa está incluída conforme solicitado.

## Detalhes técnicos e testes
- Reutilizar Supabase, React Query, controles e fluxos de gravação atuais; não criar tabelas ou migrações.
- Separar lógica de extração/validação da função para testar sem chamadas pagas nem segredos.
- Testar JWT/permissão (403 para não curador), PDF sem texto sem chamada à IA, JSON inválido com fallback único, detecção de campos cortados, descarte/restauração e nenhuma gravação sem confirmação.
- Rodar a suíte existente e os novos testes. Conferência real de OpenRouter depende da chave; verificação autenticada depende de sessão disponível no Supabase externo.