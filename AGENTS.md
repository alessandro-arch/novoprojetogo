# AGENTS

- Service Desk tenant = `public.organizations`; every `sd_*` table carries `organization_id` and RLS uses `sd_is_member`/`sd_is_admin`/`sd_in_group` — keeps institutions isolated without a parallel tenant model.
- Institution-specific rules (durations, contract types, alert lead times, groups) live in `sd_settings`/`sd_groups`, never in code — the module must serve multiple institutions.
- The `institutions` table is the eMEC catalogue for profile affiliation, not a tenant — do not reuse it for Service Desk.
