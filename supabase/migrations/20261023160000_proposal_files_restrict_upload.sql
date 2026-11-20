-- PROPOSTA (não aplicada). Etapa 2 da auditoria de segurança.
--
-- Problema: existem duas políticas de INSERT permissivas no bucket privado proposal-files:
--   "proponente uploads own files"        -> qualquer autenticado, em qualquer pasta
--   "proponente uploads own proposal files" -> qualquer autenticado, na pasta proposals/*
-- Leitura e exclusão já estão restritas ao dono (ou à equipe da organização), mas qualquer
-- usuário logado pode ENVIAR arquivos para a pasta de OUTRA proposta (poluição e consumo de
-- armazenamento) ou para pastas arbitrárias.
--
-- O front-end grava em  proposals/<proposal_id>/<timestamp>_<arquivo>  (ProposalForm.tsx).
-- Esta migration passa a exigir esse caminho e que a proposta pertença ao usuário e esteja em rascunho.
--
-- Verificação sugerida (ambiente de teste):
--   1. Proponente A envia para proposals/<proposta_de_A>/x.pdf com a proposta em draft: deve funcionar.
--   2. Proponente A envia para proposals/<proposta_de_B>/x.pdf: deve falhar (RLS).
--   3. Proponente A envia para outra raiz (ex.: tmp/x.pdf): deve falhar.
--   4. Proponente A envia para a própria proposta já submetida (status diferente de draft): deve falhar.
-- Atenção: confirme que o fluxo de reenvio/ajuste de proposta não depende de upload após o status draft.

DROP POLICY IF EXISTS "proponente uploads own files" ON storage.objects;
DROP POLICY IF EXISTS "proponente uploads own proposal files" ON storage.objects;

CREATE POLICY "proponente uploads files to own draft proposal" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'proposal-files'
    AND (storage.foldername(name))[1] = 'proposals'
    AND EXISTS (
      SELECT 1
      FROM public.proposals p
      WHERE p.id::text = (storage.foldername(name))[2]
        AND p.proponente_user_id = auth.uid()
        AND p.status = 'draft'
    )
  );
