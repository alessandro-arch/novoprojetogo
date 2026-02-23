

# Redesign da Landing Page e Login do ProjetoGO (estilo BolsaGO)

## Resumo

Redesenhar completamente a landing page (Index) e a pagina de login do ProjetoGO, inspirando-se no layout limpo e institucional do BolsaGO. A landing page ganha novas secoes (hero, beneficios, "para quem e", CTA com fundo escuro, desafios, footer rico). O login recebe um visual mais limpo e alinhado.

---

## Secoes da nova Landing Page

Com base nas telas do BolsaGO, a landing page tera estas secoes em ordem:

1. **Header fixo** -- Logo "ProjetoGO" + subtitulo "Powered by InnovaGO" + link discreto de acesso admin
2. **Hero** -- Fundo branco/claro, label "UMA SOLUCAO INNOVAGO", titulo grande em preto/azul escuro, subtitulo cinza, dois botoes ("Acessar Portal" solid escuro + "Sou Proponente" outline)
3. **Editais Publicos** (mantida, se houver dados)
4. **Beneficios** -- Fundo levemente cinza, label "BENEFICIOS", titulo "Por que escolher a Plataforma ProjetoGO?", lista de itens com check icon em cards de borda suave
5. **Para Quem E** -- Label "PARA QUEM E", titulo "Uma solucao para diferentes perfis", cards centralizados com icone + titulo + descricao
6. **CTA escuro** -- Fundo azul escuro/navy, texto branco "Quer ver a plataforma em acao?", botao outline branco
7. **Desafios** -- Fundo cinza claro, label "OS DESAFIOS", titulo "Por que a gestao de editais e tao complexa?", cards com icone + titulo + descricao
8. **CTA final** -- Fundo navy, titulo + subtitulo + dois botoes (Ver planos / Acessar portal)
9. **Footer** -- Fundo escuro navy, duas colunas (info do produto + links), copyright

---

## Arquivos a criar/editar

### 1. `src/components/landing/HeroSection.tsx` (reescrever)
- Remover gradiente escuro, usar fundo `bg-background` (branco/cinza claro)
- Header simples com logo texto (sem icone colorido no fundo escuro)
- Titulo em `text-foreground` (escuro), palavra destaque em `text-primary`
- Botoes: primeiro com fundo escuro navy (`bg-[hsl(220,25%,12%)]`), segundo outline
- Remover SVG wave inferior

### 2. `src/components/landing/BenefitsSection.tsx` (novo)
- Secao com fundo `bg-muted/30`
- Label verde/primary uppercase
- Lista de 5 beneficios em cards com borda leve e icone check

### 3. `src/components/landing/AudienceSection.tsx` (novo)
- Secao "Para Quem E"
- 3 cards centralizados: Universidades, Empresas, Agencias de Fomento
- Cada card com icone em circulo cinza + titulo + descricao

### 4. `src/components/landing/CTASection.tsx` (novo)
- Componente reutilizavel com fundo navy escuro
- Texto branco, botao outline branco

### 5. `src/components/landing/ChallengesSection.tsx` (novo)
- Label "OS DESAFIOS", titulo
- 4 cards com icone em box cinza + titulo + descricao

### 6. `src/components/landing/FeaturesSection.tsx` (reescrever)
- Atualizar para o estilo mais limpo com cards de borda suave (sem sombra forte)
- Icones em circulos com fundo cinza claro

### 7. `src/components/landing/Footer.tsx` (reescrever)
- Fundo navy escuro (`hsl(220, 25%, 12%)`)
- Duas colunas: info do ProjetoGO + links do Produto
- Texto branco/cinza claro
- Copyright na base

### 8. `src/pages/Index.tsx` (atualizar)
- Importar e ordenar todas as novas secoes

### 9. `src/pages/Login.tsx` (ajustar visual)
- Manter funcionalidade, ajustar visual: card mais limpo, bordas suaves, alinhar ao estilo
- Botao de login com fundo navy escuro em vez de primary

### 10. `src/pages/Register.tsx` (ajustar visual)
- Mesmas mudancas visuais do Login

### 11. `src/components/ui/button.tsx`
- Adicionar variante `"dark"` para botoes com fundo navy escuro
- Ajustar variante `"hero"` para fundo navy solido (sem gradiente)
- Adicionar variante `"hero-outline"` para borda branca em fundo escuro

---

## Detalhes tecnicos

- Paleta principal mantida: azul institucional `hsl(215, 65%, 30%)` como primary
- Cor navy escura para CTAs e footer: `hsl(220, 25%, 12%)`
- Fonte Plus Jakarta Sans mantida
- Cards com `rounded-xl border border-border/50` e sombra minima
- Labels de secao: texto uppercase, tracking-wider, tamanho `text-sm`, cor `text-primary`
- Todos os componentes usam Tailwind e Shadcn/ui existentes
- Nenhuma dependencia nova necessaria

