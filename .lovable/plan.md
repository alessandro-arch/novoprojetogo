# MFA guiado no login (somente prévia)

## Fluxo
1. Login com e-mail e senha (sem mudança).
2. Novo passo "Verificação em duas etapas" antes de abrir qualquer painel:
   - Sem autenticador: tela guiada com explicação simples, QR Code, campo de 6 dígitos, mensagem clara para código errado. Ativa só após código correto.
   - Com autenticador: pede o código de 6 dígitos, salvo se o dispositivo estiver lembrado.
3. Conta `projetogo-admin@innovago.app` (identificada pelo ID, via variável da prévia, igual ao bloqueio atual): MFA obrigatório e sem opção de lembrar dispositivo.
4. Demais usuários: tela aparece no primeiro login com botão "Agora não" (continua opcional).
5. Após validar: caixa "Não pedir novamente neste dispositivo por 30 dias".
6. Ações críticas (remover autenticador, trocar senha, gerenciar dispositivos) sempre pedem o código de novo, mesmo em dispositivo lembrado.
7. Cartão Segurança em Meu perfil passa a ter: trocar/remover autenticador, lista de dispositivos lembrados com "Revogar", "Sair de todos os dispositivos".

## Modelo de armazenamento do dispositivo confiável
Exige servidor e tabela, porque cookie HttpOnly não pode ser criado pelo navegador e a lista/revogação precisa ficar no banco.

- Tabela nova `mfa_trusted_devices`: id, user_id, token_hash (SHA-256), nome do dispositivo (navegador/sistema), criado_em, expira_em, revogado_em, ultimo_uso_em. RLS: usuário só vê e revoga os próprios; nunca vê o hash.
- Função de servidor `mfa-trusted-device` (exige sessão em nível MFA aal2 para registrar):
  - registrar: gera token aleatório, grava só o hash, devolve cookie Secure + HttpOnly + SameSite=Strict, validade 30 dias (0 para a conta administrativa).
  - verificar: confere cookie, hash, prazo e revogação.
  - revogar / revogar todos: marca revogado_em; "Sair de todos" também encerra sessões.
- Nenhum token, QR ou código em logs.

Observação: isso requer uma migration e uma função de servidor. As regras anteriores proíbem ambas. Opções:
- A) Autorizar migration + função apenas no ambiente de teste.
- B) Fazer agora só o passo guiado no login (QR, código, obrigatório para a conta admin), sem "lembrar dispositivo"; o lembrete fica para depois da autorização.

Códigos de recuperação: o provedor de autenticação não oferece nativamente; ficam para etapa posterior (também exigem tabela).

## Arquivos
- Novo `src/pages/MfaVerificacao.tsx` (tela guiada/desafio)
- Novo `src/components/MfaGate.tsx` (bloqueia painéis até aal2 ou dispositivo lembrado)
- Novo `src/lib/mfa-policy.ts` (regras puras: obrigatório, prazo, ação crítica)
- `src/contexts/AuthContext.tsx` (expor nível MFA)
- `src/App.tsx` (envolver rotas protegidas e logins de cada portal)
- `src/components/MfaSecurityCard.tsx` (dispositivos, revogar, sair de todos, reautenticação)
- Opção A: `supabase/migrations/...mfa_trusted_devices.sql`, `supabase/functions/mfa-trusted-device/`
- Testes: `src/test/mfa-policy.test.ts`, `src/test/mfa-gate.test.tsx` (primeiro login, código válido/inválido, login com MFA, lembrado, expirado, revogado, ação crítica)

Sem publicação, sem novos perfis.
