# Correções da auditoria — 15/11/2026

Esta entrega cobre uma primeira rodada de correções comprovadas. Não encerra os 45 itens da auditoria nem substitui testes com contas de staging, pagamento de teste ou validação jurídica/científica.

## Comportamento corrigido

Primeiro acesso exige que o e-mail coincida com o contato já cadastrado pela instituição; conta sem contato deve ser regularizada pela secretaria. A vinculação é condicional a user_id nulo e exige uma linha afetada. Falha na verificação de limite de tentativas não libera cadastro.

Convites de fomento restringem admin à organização do seu perfil; só superadmin pode escolher outra. A organização precisa existir. Conflito com superadmin/vínculo de outra organização é verificado antes de reenvio. A busca de conta percorre páginas de até 200 usuários. Erros de persistência de perfil e organização não retornam sucesso.

find_profile_by_email deixa de ser diretório anônimo: somente service_role ou usuário autenticado com perfil administrativo válido de fomento, ICCA ou Service Desk ativo recebe resultados. A busca administrativa global por e-mail é preservada para os fluxos existentes de convite; a autorização do convite continua exigindo a organização correta.

## Aplicado em produção

Banco `vxvnrocwixzwbjamfiqr`: migração `20261115210657_restrict_profile_lookup_to_administrators`; anon sem EXECUTE, authenticated com validação interna, service_role preservado. sd-first-access v30→v31 e invite-fomento-admin v35→v36 publicados após conferir que os arquivos anteriores coincidiam com HEAD. Snapshots anteriores preservados na entrega operacional.

A mensagem de orientação no frontend ainda requer publicação deste branch.

## Validação

Suíte completa: 29 arquivos/275 testes passaram. Quatro novos testes de política e paginação passaram, repetidos após os últimos ajustes. Build aprovado. Deno check das duas funções aprovado. Produção: GET em primeiro acesso devolveu 405; POST de convite sem sessão devolveu 401. Não foram criadas contas reais, enviados convites ou vinculadas matrículas em teste.

## Pendências e reversão

Validar fixtures de cadastro com e-mail institucional, confirmação e-mail, corrida de vinculação, dois tenants, criação parcial e falha de e-mail. As duas gravações perfil/organização do convite ainda não são uma transação única. MFA obrigatório no servidor, limites do Ver como e revisão de políticas continuam abertos.

Reversão: snapshots v30/v35 podem ser reimplantados temporariamente, mas reintroduzem as vulnerabilidades. Não restaurar acesso anônimo à busca de perfis. Ajustar os contatos institucionais legítimos em vez de remover a validação.
