# Alunos: semestre, edição e acesso ao Service Desk

## Objetivo
Melhorar a aba **Alunos** para consultar a base vigente por semestre, corrigir registros importados e controlar separadamente o acesso de cada aluno ao Service Desk.

## Implementação
- Adicionar filtro de **Período/Semestre**, alimentado pelo histórico de importações de alunos.
- Mostrar em cada aluno o período da sua importação mais recente; o filtro considerará esse vínculo, preservando a regra de que o arquivo mais recente é a fonte vigente.
- Adicionar ação **Editar** por aluno, abrindo formulário com todos os campos: matrícula, nome, CPF protegido, telefone, e-mail, turma, programa, nível, ingresso, término previsto, orientador, bolsa, prazo vigente e situação.
- Manter o prazo regular calculado automaticamente pelas regras institucionais; alterações de ingresso ou nível recalculam esse prazo.
- Permitir trocar o orientador apenas entre professores habilitados para orientar.
- Adicionar controle **Acesso ao Service Desk: ativo/desativado**, independente da situação acadêmica do aluno e sem bloquear sua conta nos demais módulos do ProjetoGO.
- Exibir confirmações e mensagens de erro nas ações de salvar e ativar/desativar.

## Dados e segurança
- Acrescentar ao cadastro do aluno um indicador próprio de acesso ao Service Desk, com valor inicial ativo.
- Manter a edição restrita aos administradores institucionais pelas regras atuais de acesso ao banco.
- Continuar armazenando CPF somente como hash e últimos quatro dígitos; na edição, o CPF atual será mascarado e um novo valor poderá substituí-lo.
- Preservar o histórico das importações. Edições administrativas alteram a base vigente, sem modificar nem apagar o Excel original ou seus registros históricos.
