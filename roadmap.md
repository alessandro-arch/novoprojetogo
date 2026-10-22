# Roadmap — Service Desk Acadêmico

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
