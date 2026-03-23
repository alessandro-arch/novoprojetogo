

## Plan: Redesign Landing Page (/) with Full Marketing Layout

### Summary
Replace the current minimal module-selector page with a full landing page featuring a Hero section, Modules section with feature lists, Differentials section, and a proper footer. All within the existing design system (navy dark variant, Plus Jakarta Sans, rounded-xl cards).

### Changes

**Single file modified: `src/pages/Index.tsx`**

Rewrite the page with four sections, all inline (no new component files needed since the existing landing components like HeroSection/Footer are used elsewhere and we want this page self-contained):

**1. Hero Section**
- Navy background (`bg-[hsl(220,25%,12%)]`) with white text
- FileText icon + "ProjetoGO" brand
- Subtitle about the platform
- Two CTA buttons side by side: "Acessar ProjetoGO" → `/login`, "Acessar Fomento" → `/fomento/login`
- "Powered by InnovaGO" tag

**2. Modules Section**
- Light background, section title "Escolha o módulo"
- Two cards (md:grid-cols-2) with hover shadow elevation
- Left card: ProjetoGO — FileText icon, description, 5 check items, "Acessar" button → `/login`
- Right card: ProjetoGO Fomento — TrendingUp icon, "Novo módulo" badge, description, 6 check items, "Acessar" button → `/fomento/login`
- Each feature item uses CheckCircle2 icon

**3. Differentials Section**
- Muted background, title "Por que usar o ProjetoGO?"
- Three columns (lg:grid-cols-3): AI (Bot icon), Strategic Vision (BarChart3 icon), Proactive Alerts (Bell icon)
- Each with icon in circle, title, and description text

**4. Footer**
- Navy background, single line: "ProjetoGO · Plataforma de gestão de projetos e captação de recursos"
- "Powered by InnovaGO" and copyright

### Technical Details
- Uses existing design tokens: `variant="dark"` buttons, `variant="hero-outline"`, navy hsl color, Badge component
- Icons from lucide-react: FileText, TrendingUp, ArrowRight, CheckCircle2, Bot, BarChart3, Bell
- No route changes, no new files needed — everything in Index.tsx
- Responsive: single column on mobile, two columns on md+

