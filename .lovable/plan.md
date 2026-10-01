# Áreas do Professor, do Aluno e do DTI (Fase 3)

## O que muda para cada pessoa

**Professor** (ao entrar em /servicedesk)
- Meus dados institucionais (somente leitura) — correção: os programas e o vínculo (Permanente/Colaborador) passam a aparecer (hoje aparece "—").
- Meu contato: e-mail pessoal e celular com WhatsApp (único dado que ele edita).
- Informar divergência: aponta um dado errado (ex.: nome, programa) com uma explicação; vai para a PRPPGE revisar. A base oficial não muda sozinha.
- Solicitar acesso VPN — Portal de Periódicos CAPES: aceita o termo de uso (registrado com data, hora e código de integridade) e envia o pedido.
- Minhas solicitações: situação de cada pedido (Em análise, Aprovado, Concluído, Recusado), com histórico.
- Meus orientandos: lista dos alunos que ele orienta (somente leitura).

**Aluno**
- Mesmos blocos do professor, com os dados de aluno: programa, nível, turma, ingresso, orientador, prazo regular e prazo vigente.
- Aluno trancado ou com acesso desativado vê o aviso de acesso suspenso e não consegue pedir VPN.

**PRPPGE** (integrantes do grupo)
- Fila "Para aprovar": pedidos de VPN novos — Aprovar ou Recusar (com motivo).
- Fila "Divergências": marca como resolvida depois de corrigir a base.

**DTI** (integrantes do grupo)
- Fila "Para executar": pedidos já aprovados pela PRPPGE.
- Botões "Em andamento" e "Concluído" (com observação, ex.: login VPN entregue) ou "Recusar".
- Busca por nome/matrícula e histórico dos atendidos.

**Avisos por e-mail** (noreply@innovago.app): solicitante recebe confirmação, aprovação/recusa e conclusão; PRPPGE e DTI recebem aviso de pedido novo na sua fila.

## Fluxo do pedido de VPN

```text
Solicitante envia -> PRPPGE aprova -> DTI executa -> Concluído
                     \-> Recusado      \-> Recusado
```

## Detalhes técnicos
- Tabelas novas com `organization_id` e RLS: `sd_requests` (tipo, solicitante, status, grupo atual, termo aceito + hash SHA-256), `sd_request_events` (histórico imutável), `sd_divergences`. Catálogo de serviços em `sd_services` (VPN CAPES semeado para a UVV, com etapas PRPPGE→DTI configuradas por dados, não no código).
- Políticas: solicitante vê só os próprios; integrantes do grupo vêem a fila do seu grupo (`sd_in_group`); admin vê tudo.
- Correção de "Programas —": política de leitura própria em `sd_faculty_programs`/`sd_programs` para o professor vinculado.
- Contato do professor: colunas `email_personal`/`phone` em `sd_faculty` editáveis só pelo próprio (via função segura, sem tocar dados institucionais).
- Roteamento em /servicedesk: equipe vê painel admin + filas dos seus grupos; professor/aluno vê sua área.
- Edge function de e-mail reaproveitando o Resend existente.
