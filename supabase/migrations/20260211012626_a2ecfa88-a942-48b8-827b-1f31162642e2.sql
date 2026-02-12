
-- Expand edital_status enum with new workflow states
ALTER TYPE public.edital_status ADD VALUE IF NOT EXISTS 'em_avaliacao';
ALTER TYPE public.edital_status ADD VALUE IF NOT EXISTS 'resultado_preliminar';
ALTER TYPE public.edital_status ADD VALUE IF NOT EXISTS 'resultado_final';
ALTER TYPE public.edital_status ADD VALUE IF NOT EXISTS 'homologado';
ALTER TYPE public.edital_status ADD VALUE IF NOT EXISTS 'outorgado';
ALTER TYPE public.edital_status ADD VALUE IF NOT EXISTS 'cancelado';

-- Add cancellation_reason column to editais
ALTER TABLE public.editais ADD COLUMN IF NOT EXISTS cancellation_reason text;
