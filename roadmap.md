# Roadmap — Service Desk Acadêmico

- [ ] Operon valores: confirmação individual com observação específica, ausência sem zero nem confirmação; somente preview, nenhuma alteração de dados em produção.

- [x] Operon portal fases 1 e 2: menu lateral, Visão geral com indicadores e gráficos, Chamadas com ordenação/chips/filtros salvos/CSV/painel lateral/Seguir na linha, Prazos, Meus alertas e Fontes; 202 testes passaram.
- [x] Operon ajustes do portal: data de publicação prefere a agência (conferência vira "aproximada" com tooltip e marca no CSV), Saúde das coletas por fonte (Ok/Atenção/Falha/Sem coleta, 36h e falhas seguidas, último erro expansível) e Indicadores de usuários na Curadoria via RPC agregada com aviso elegante enquanto a função não existe; 218 testes passaram, compilação sem erros, sem publicar.
- [ ] Operon painel de usuários da Curadoria: aplicar a RPC agregada oe_indicadores_usuarios no banco. Bloqueio: SQL em revisão pelo proprietário (outra branch); a UI já trata a ausência da função.

- [x] Operon menu de usuário nas três telas, perfil com edição do próprio nome, Curadoria por papel efetivo, Meus alertas e logout exclusivo; 186 testes passaram, compilação sem erros, sem publicar ou alterar banco.
- [ ] Operon menu: conferir edição e leitura do nome com conta real. Bloqueio: Supabase externo sem sessão autenticada de teste disponível.

- [x] Complemento Telegram: aviso de conta, expiração local com novo código, opção desativada sem vínculo e proteção Ver como; 129 testes Vitest passaram, compilação sem erros, sem mudanças de banco.
- [ ] Complemento Telegram: conferir vínculo real pelo Hermes. Bloqueio: Supabase externo sem sessão autenticada de teste; a RPC não informa códigos expirados antes de abrir Meus alertas, portanto o aviso local cobre somente códigos observados nesta tela.

- [x] Operon acabamento: filtro UF removido preservando os tipos da fonte, prazo genérico sem rodadas com mensagens de situação preservadas, fontes ativas para curador sem organização e cache separado do painel; 104 testes passaram e compilação sem erros.

- [x] Operon: CAPES, fontes institucionais dinâmicas por RLS, filtros de esfera/UF e prazo não divulgado; 95 testes passaram e compilação sem erros, contraste CAPES 6,23:1.
- [ ] Operon fontes: conferir filtros com conta real em computador/celular. Bloqueio: Supabase externo sem sessão de teste disponível.

- [x] Fase 1 — Fundação institucional (instituições, membros, grupos, configurações, painel /servicedesk)
- [x] Fase 2 — Programas, alunos, professores (orientador = professor "pode orientar"), importação Excel versionada
- [ ] Fase 3 — Primeiro acesso por matrícula, catálogo, workflow, termo + hash, serviço VPN CAPES
- [ ] Fase 4 — Notificações Resend, alerta 7 dias, prorrogação, revogação, dashboards por grupo
- [x] Homologação Fase 2 (testes automáticos + prazos no banco); 7º programa removido
- Requisito Fase 3: dados institucionais somente leitura + "Informar divergência"
- Requisito Fase 3: aluno cadastra com e-mail pessoal; professor só com e-mail do domínio da instituição (UVV @uvv.br)

- [x] Operon Editais etapa 1: tela de curadoria em /editais/curadoria
- [x] Operon Fomento: login exclusivo, redirecionamentos e saída para /editais/login
- [x] Operon: campos e restrições para IES, saída exclusiva e recuperação com retorno ao módulo (17 testes e caminhos públicos conferidos; fluxo com conta real não disponível neste projeto)
- [x] Operon: selos por fonte, filtros vigentes/julgamento e confirmação de publicação sem rodadas (26 testes passaram; conferência com conta real indisponível)
- [x] Operon: abrangência nos filtros, cartões e edição da curadoria (35 testes passaram; gravação real aguarda coluna e sessão de teste)
- [x] Operon portal etapa 1: painel com busca/abas, ficha publicada, eventos liberados e seguir/deixar de seguir; 55 testes passaram, compilação sem erros e rotas exigem login Operon.
- [ ] Operon portal: conferir apresentação em computador/celular e seguir/deixar de seguir com conta real. Bloqueio: Supabase externo sem sessão de teste disponível.
- [x] Operon curadoria: status e abas com contagem, publicação visível com rollback, despublicação confirmada e aviso de alterações não salvas; 66 testes passaram, compilação sem erros, portal preservado.
- [x] Operon ficha/curadoria: tipos locais vinculados aos campos gerados da migração 006, TL;DR editável e público, linha do tempo derivada e textos completos; 76 testes passaram e compilação sem erros, sem alterar acessos ou outras telas.
- [x] Operon IA de curadoria: extração PDF, OpenRouter, sugestões revisáveis e confirmação das rodadas; OPENROUTER_API_KEY salvo pelo formulário seguro e função instalada.
- [x] Operon IA: 80 testes da suíte e 9 testes Deno passaram, validação Deno sem erros e função instalada bloqueia JWT inválido com 401; sem alterações em login, rotas ou portal.
- [ ] Operon IA: apresentação autenticada em computador/celular e gravação confirmada de rodadas. Bloqueio: Supabase externo sem sessão de teste disponível; extração com PDF oficial e chamadas reais OpenRouter verificadas diretamente, sem gravação.
- [ ] Operon curadoria: conferir publicação/despublicação com conta real e apresentação em computador/celular. Bloqueio: Supabase externo sem sessão autenticada disponível para teste.
- [x] Operon IA: erro 502 reproduzido como timeout do reserva; raciocínio desativado, erros específicos e diagnóstico seguro, correção instalada; PDF oficial retornou sugestões validadas em 19 segundos, sem gravação; 80 testes Vitest e 15 Deno passaram.
- [x] Operon IA: DeepSeek v4.1 Flash substitui Nemotron nas duas tentativas; função instalada, 16 testes Deno passaram e PDF oficial retornou sugestões validadas em 14 segundos sem gravação.
- [x] Operon IA: TL;DR validado com PDF oficial após separar síntese/evidência e exigir JSON estruturado; todos os nove campos passaram na validação real, 18 testes Deno passaram, sem gravação automática.
- [x] Operon IA: CPU Time exceeded confirmado nos logs; leitura em lotes autenticados da mesma função instalada, 23 testes Deno e 80 Vitest passaram; PDF oficial completo (39 páginas) gerou TL;DR e nove campos sem gravação. Chamada instalada bloqueou sessão ausente com 401; geração autenticada no ambiente hospedado ainda depende de sessão válida.
