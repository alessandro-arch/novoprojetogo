

## Update Landing Page to Previous Layout + Fomento Module

Restore the full marketing landing page structure from the screenshots while keeping the Fomento module section.

### Changes

**`src/pages/Index.tsx`** — Rewrite to compose existing landing components plus a new Fomento section:

1. `HeroSection` — existing component (header + hero with CTAs)
2. `FeaturesSection` — 6 feature cards in 3x2 grid
3. `ChallengesSection` — 4 challenge cards in 2x2 grid
4. `BenefitsSection` — 5 benefit items
5. `AudienceSection` — 3 audience cards
6. **New: Fomento module section** — dedicated section highlighting ProjetoGO Fomento with its features (IA, dashboards, alerts, etc.) and a CTA to `/fomento/login`. Styled as a distinct card or section with the "Novo módulo" badge, preserving the current Fomento features list.
7. `CTASection` — "Quer ver a plataforma em ação?" with demo CTA
8. Second `CTASection` — "Pronto para transformar a gestão dos seus editais?" with Portal + Proponente CTAs
9. `Footer` — existing 4-column footer

### Files Changed

| File | Change |
|---|---|
| `src/pages/Index.tsx` | Replace current content with composition of landing components + Fomento section |

No changes needed to existing landing components — they already match the screenshots.

