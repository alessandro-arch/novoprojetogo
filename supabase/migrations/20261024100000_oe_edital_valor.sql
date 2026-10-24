-- PROPOSTA (nao aplicada). Fase 3 do portal Operon: valor dos editais.
--
-- Hoje nao existe campo numerico de valor; so o texto livre oe_edital.recursos.
-- Esta migration so ADICIONA colunas opcionais em oe_edital. Nao altera policies, RPCs nem dados
-- existentes, e nao preenche nada: o preenchimento vem da coleta (Hermes, com trecho literal em
-- oe_extracao) e da confirmacao do curador.
--
-- Regra de negocio: o dashboard soma apenas valores confirmados do tipo 'total' ou 'estimado'
-- e mostra a contagem de editais "sem valor informado" ao lado, sem estimar em silencio.
--
-- valor_tipo:
--   total        : o edital declara um valor global
--   estimado     : o edital declara valor "estimado" ou "previsto"
--   por_agencia  : valor dividido ou descentralizado entre agencias/paises (nao soma em um total unico)
--   nao_informado: o edital nao traz valor
--
-- Verificacao sugerida (depois de aplicar):
--   select column_name from information_schema.columns where table_name='oe_edital' and column_name like 'valor%';
--   insert/update de valor_total_reais negativo deve FALHAR (check).

ALTER TABLE public.oe_edital
  ADD COLUMN IF NOT EXISTS valor_total_reais numeric(16,2),
  ADD COLUMN IF NOT EXISTS valor_tipo text,
  ADD COLUMN IF NOT EXISTS valor_observacao text,
  ADD COLUMN IF NOT EXISTS valor_confirmado_em timestamptz,
  ADD COLUMN IF NOT EXISTS valor_confirmado_por uuid;

ALTER TABLE public.oe_edital
  ADD CONSTRAINT oe_edital_valor_nao_negativo CHECK (valor_total_reais IS NULL OR valor_total_reais >= 0),
  ADD CONSTRAINT oe_edital_valor_tipo_valido CHECK (valor_tipo IS NULL OR valor_tipo IN ('total', 'estimado', 'por_agencia', 'nao_informado')),
  ADD CONSTRAINT oe_edital_valor_coerente CHECK (
    valor_tipo IS NULL
    OR (valor_tipo IN ('total', 'estimado') AND valor_total_reais IS NOT NULL)
    OR (valor_tipo IN ('por_agencia', 'nao_informado'))
  );

COMMENT ON COLUMN public.oe_edital.valor_total_reais IS 'Valor global em reais declarado no edital; nulo quando nao informado.';
COMMENT ON COLUMN public.oe_edital.valor_tipo IS 'total | estimado | por_agencia | nao_informado';
COMMENT ON COLUMN public.oe_edital.valor_observacao IS 'Trecho curto e literal do edital que sustenta o valor (ex.: linhas, agencias, ressalvas).';
