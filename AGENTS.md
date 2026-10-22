# AGENTS
- Operon curation fetches status-independent lists and derives combined-filter tab counts from the same cache; optimistic status transitions snapshot and restore that cache so publication keeps selection visible without changing the public portal.
- Operon user portal uses a published-only query layer with explicit released-event filtering and user-scoped following; this prevents exposure of pending events and keeps notification delivery outside the frontend.
- Operon geographic scope uses AbrangenciaBadge and shared scope options/matching for both views; this keeps curator and published filters consistent without schema changes.
- Operon source badges use FonteBadge and dedicated global color tokens with Badge variants; this keeps agency identity consistent without changing platform theme roles.
- Operon Fomento uses the shared Supabase session with a dedicated module login and reads existing role and organization-config RLS results for admission; this keeps module entry points separate without parallel authentication or tenant models.
- Operon protected entry uses an RLS-backed admission gate and navigates to its login before sign-out; recovery return paths are allowlisted and carried by the existing email sender, preventing cross-module redirects without new authentication infrastructure.
- Service Desk operations: one Central de Atendimento at /servicedesk/atendimento for every responsible group (context via ?grupo=); stage type (analysis = 1st step, execution = later steps) and modules derive from service steps, never group names; legacy /servicedesk/<group code> redirects there; VPN release goes through `sd_release_vpn` + private `servicedesk` bucket path `<org>/vpn/<request>/` and `sd-notify` event `liberar_vpn`.

- Service Desk tenant = `public.organizations`; every `sd_*` table carries `organization_id` and RLS uses `sd_is_member`/`sd_is_admin`/`sd_in_group` — keeps institutions isolated without a parallel tenant model.
- Institution-specific rules (durations, contract types, alert lead times, groups) live in `sd_settings`/`sd_groups`, never in code — the module must serve multiple institutions.
- The `institutions` table is the eMEC catalogue for profile affiliation, not a tenant — do not reuse it for Service Desk.
- Student account status is module-scoped through `sd_students.service_desk_access_active`; never disable the shared ProjetoGO account when blocking Service Desk access.
- Service Desk areas: /servicedesk routes each user to Portal (sd_students/sd_faculty), a panel per responsible group (/servicedesk/<group code>, approver vs executor derived from service steps, never from group names) or /servicedesk/admin; request detail at /servicedesk/solicitacao/:id — one shared request/notification model, no parallel user structures.
- Public institution guides are orientation-only entry pages that reuse existing Service Desk login and first-access routes, never parallel authentication or workflows.
