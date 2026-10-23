# "Ver como": seletor de papel para o dono da plataforma

Obs.: o complemento do Telegram (aviso de conta, código expirado, chave desativada no Seguir) segue pendente e entra depois deste plano.

## Comportamento
- Botão "Ver como" só para quem tem `profiles.fomento_role = 'superadmin'` lido do banco. Sem e-mail fixo. Os outros usuários não veem botão, seletor de organização nem faixa, e o override deles é descartado.
- Fica no cabeçalho dos painéis, ao lado do menu do usuário, em todos os módulos. Os módulos com cabeçalho próprio também recebem o botão: Operon, Service Desk e o painel admin.
- Seletor de papel com estas opções: Superadmin (real), Admin Fomento, Gestor, Auditor, Coordenador, Admin ICCA, Admin Org, Gestor de Edital, Avaliador, Proponente, Solicitante Service Desk, Atendente de grupo, Sem papel.
- Seletor "Organização" ao lado do de papel, com a organização atual como padrão. Vale para os papéis ligados a organização: Admin Org, Gestor de Edital, Avaliador, Proponente, Admin Fomento, Gestor, Auditor, Coordenador e os dois papéis do Service Desk. Fica oculto para Superadmin (real), Admin ICCA e Sem papel.
- Atendente de grupo: um terceiro seletor "Grupo" lista os grupos do Service Desk da organização escolhida.
- Quando ativo, aparece uma faixa fixa no topo, em cor de alerta do tema: "Visualizando como <papel> em <organização>." com o botão "Voltar ao Superadmin".
- Tooltip no botão e na faixa: "Simulação de interface. O banco continua autorizando como Superadmin, então podem aparecer dados além do que este papel veria."
- Nada é gravado no banco. Persistência só em `sessionStorage` (`{ userId, papel, orgId, grupoId }`, com try/catch). A escolha é apagada ao sair e ao trocar de usuário.

## Bloqueio de gravação durante a simulação
O bloqueio tem duas camadas:
1. **Interface:** o hook `useModoVisualizacao()` desativa os botões que gravam nos gates e formulários principais. Cada um mostra "Modo visualização" no tooltip.
2. **Rede (garantia central):** enquanto a simulação estiver ativa, o `ViewAsProvider` instala um filtro no `fetch` do navegador. Para o endereço do Supabase, ele recusa POST, PATCH, PUT e DELETE em `/rest/v1`, em `/storage/v1` e nas edge functions. A recusa devolve o erro "Modo visualização" e mostra um toast, sem enviar nada ao servidor. Passam apenas:
   - leituras GET;
   - login, sessão e logout em `/auth/v1`;
   - uma lista fixa de consultas que só leem: `oe_is_curador`, `oe_status_telegram`, `sd_me`, `sd_check_vpn_eligibility`, `get_user_org_id`, `get_user_org_role`, `has_role`, `is_org_member`, `list_fomento_users`, `find_profile_by_email`, `sd_members_signup_status`.

   Ao voltar ao Superadmin, o filtro é removido. Assim, mesmo um botão esquecido não grava nada.

## Lista de organizações sem expor dados
- A consulta só existe dentro do `ViewAsSwitcher`. Ela fica desligada (`enabled: false`) enquanto o papel real lido do banco não for superadmin, então nenhuma requisição sai para os demais usuários.
- Busca apenas `id, name, sigla, is_active` de `organizations`, ordenadas por nome. O superadmin enxerga todas pelas políticas atuais (`icca_admin`/`sd_is_superadmin`).
- Sem política, função ou migração nova.
- Observação: a política atual `orgs_anon_select` já deixa qualquer pessoa ler organizações ativas, mesmo sem login. Isso é anterior a este trabalho e não muda com o plano. Posso revisar à parte, se quiser.
- Grupos do Service Desk: lidos de `sd_groups` da organização escolhida, também só quando o papel real é superadmin.

## Desenho do override
Novo módulo central `src/lib/view-as.ts` com o contexto `ViewAsProvider`, montado acima de AuthProvider e FomentoAuthProvider:

```text
papel simulado (sessionStorage: { userId, papel })
        |
ViewAsProvider ── aceita só se realFomentoRole === 'superadmin' e userId confere
        |
mapa papel -> { globalRole, membershipRole, fomentoRole, operon, servicedesk }
        |
AuthContext / FomentoAuthContext devolvem os valores simulados
e expõem realFomentoRole, realGlobalRole, viewAs
```

Mapa de papéis:

| Papel | globalRole | membership.role | fomentoRole | Operon / curadoria | SD admin |
|---|---|---|---|---|---|
| Superadmin (real) | sem override | | | | |
| Admin Fomento | null | proponente | admin | não / não | não |
| Gestor | null | proponente | gestor | não / não | não |
| Auditor | null | proponente | auditor | não / não | não |
| Coordenador | null | proponente | coordenador | não / não | não |
| Admin ICCA | icca_admin | real | null | sim / sim | sim |
| Admin Org | null | org_admin | null | conforme org / não | não |
| Gestor de Edital | null | edital_manager | null | conforme org / não | não |
| Avaliador | reviewer | reviewer | null | conforme org / não | não |
| Proponente | null | proponente | null | conforme org / não | não |
| Solicitante Service Desk | null | proponente | null | conforme org / não | não, Portal do solicitante |
| Atendente de grupo | null | proponente | null | conforme org / não | não, Central só do grupo escolhido |
| Sem papel | null | null | null | não / não | não |

Nos papéis ligados a organização, `membership.organization_id` e `fomentoOrgId` passam a ser a organização escolhida no seletor.

- Funções puras: `aplicarViewAs(real, escolha)`, `lerViewAs`, `salvarViewAs`, `limparViewAs`. O override só sai de `aplicarViewAs` quando o papel real é superadmin e o `userId` salvo é o do usuário atual.
- `operon-access.ts`: `checkOperonAccess` recebe o override. Curadoria e IA (`oe_is_curador` no cliente) passam por um helper `podeCurar()` que respeita a simulação.
- Service Desk: `isSuper`, os grupos do painel e o tipo de solicitante passam pelo override.
  - Solicitante: abre o Portal com um perfil simulado em modo só de leitura, sem catálogo de envio.
  - Atendente: abre a Central só com o grupo escolhido.
  - Administração: só "Admin ICCA".
- Sair: `signOut` dos dois contextos e `logoutOperon` chamam `limparViewAs()`. Uma troca de usuário em `onAuthStateChange` também limpa.
- Ao trocar de papel ou organização, os caches de consulta são invalidados para os gates recalcularem.

## Arquivos que seriam alterados
- Novos: `src/lib/view-as.ts` (mapa, armazenamento, filtro de gravação), `src/components/ViewAsSwitcher.tsx` (seletores de papel, organização e grupo, mais a faixa), `src/hooks/use-modo-visualizacao.ts`, `src/test/view-as.test.tsx`.
- `src/contexts/AuthContext.tsx`, `src/contexts/FomentoAuthContext.tsx`, `src/App.tsx` (provider e faixa global).
- `src/lib/operon-access.ts`, `src/components/operon/OperonAccessGate.tsx`, `src/lib/operon-ia.ts`, `src/lib/operon-fontes.ts`, `src/components/operon/EditalCuradoriaDetail.tsx` (podeCurar).
- `src/components/ProtectedRoute.tsx`, `src/components/FomentoProtectedRoute.tsx`, `src/components/layout/PanelLayout.tsx` (botão no cabeçalho).
- `src/pages/admin/AdminPanel.tsx`, `src/components/fomento/FomentoAdmin.tsx`, `src/pages/servicedesk/ServiceDeskPanel.tsx`, `src/components/servicedesk/SdBases.tsx`, `ServiceCenter.tsx`, `RequesterHome.tsx`, mais os cabeçalhos de `EditaisPage`/`CuradoriaPage`.
- AGENTS.md, duas regras:
  - o override "Ver como" é central, só para superadmin real e só na interface, com gravações bloqueadas na rede;
  - admin comum (Admin Org e equivalentes) opera somente na própria organização. Só o superadmin real atravessa organizações e só ele vê os seletores de papel e de organização.
- Sem migrações, sem políticas, sem dependências.

## Riscos
- Os dados vêm do banco como superadmin, então listas podem mostrar mais do que o papel veria. É uma limitação conhecida, avisada no tooltip.
- O filtro de rede depende da lista fixa de consultas só de leitura. Se uma tela usar uma consulta de leitura nova, ela aparece bloqueada ("Modo visualização") até entrar na lista. Esse erro é seguro: bloqueia a mais, nunca grava.
- Algumas telas consultam o papel direto no banco, como `user_roles` em `operon-access` e `sd_members` no Service Desk. Cada uma precisa passar pelo override. Uma tela esquecida mostraria o papel real. Os testes cobrem os gates centrais.
- O papel `fomento_role` fica em `profiles`, e não numa tabela de papéis separada. Não mudo isso agora, só leio.

## Testes (vitest)
- Botão, seletores e faixa ocultos para quem não é superadmin, inclusive admin e gestor. A lista de organizações não é consultada para esses usuários.
- Override salvo no sessionStorage é ignorado para quem não é superadmin ou para outro userId.
- Escolher "Auditor" muda fomentoRole e isAuditor. "Voltar ao Superadmin" restaura os valores reais.
- Escolher "Admin Org" com outra organização muda `membership.organization_id` para a escolhida.
- Durante a simulação, o filtro recusa POST, PATCH e DELETE ao Supabase com "Modo visualização". Leituras, login e consultas da lista passam. Ao voltar, gravações funcionam de novo.
- signOut e troca de usuário limpam o sessionStorage e removem o filtro.
- sessionStorage indisponível não quebra a tela.
- O mapa aplica os valores esperados a cada papel, incluindo Solicitante e Atendente de grupo.
