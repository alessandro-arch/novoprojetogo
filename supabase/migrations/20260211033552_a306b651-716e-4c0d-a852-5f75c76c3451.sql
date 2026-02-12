-- Allow org staff to insert proposals (needed for "Enviar para avaliação" flow)
CREATE POLICY "org staff inserts proposals"
ON public.proposals
FOR INSERT
WITH CHECK (
  has_org_role(auth.uid(), organization_id, 'org_admin'::app_role)
  OR has_org_role(auth.uid(), organization_id, 'edital_manager'::app_role)
);

-- Allow org staff to update proposals they manage
CREATE POLICY "org staff updates proposals"
ON public.proposals
FOR UPDATE
USING (
  has_org_role(auth.uid(), organization_id, 'org_admin'::app_role)
  OR has_org_role(auth.uid(), organization_id, 'edital_manager'::app_role)
);