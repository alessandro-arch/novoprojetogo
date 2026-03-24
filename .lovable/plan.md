

## Plano: Ajustar lógica de cálculo no Dashboard — Investimento em Formação

### Lógica atual (incorreta)
- `totalCaptado = totalCaptadoProjetos + totalComprometidoBolsas + totalCaptadoParcerias`
- O tooltip do "Total Captado" mostra 3 linhas separadas (projetos, bolsas, parcerias)
- O card "Investimento em Formação" mostra apenas projetos vs bolsas (sem incluir parcerias com modalidade bolsa)

### Nova lógica solicitada
- **Valor total em projetos** = soma de `valor_total` de todos os projetos
- **Valor total em bolsas** = `totalComprometidoBolsas` (bolsas cadastradas) + soma de `valor_total` das parcerias ativas com `modalidade === 'bolsa'`
- **TOTAL CAPTADO** = Valor total em projetos + Valor total em bolsas (apenas 2 componentes)

### Alterações em `FomentoDashboardView.tsx`

1. **Novo cálculo `totalBolsasParcerias`**: filtrar parcerias ativas com `modalidade === 'bolsa'` e somar `valor_total`

2. **Atualizar `totalBolsasGeral`**: `totalComprometidoBolsas + totalBolsasParcerias`

3. **Atualizar `totalCaptado`**: `totalCaptadoProjetos + totalBolsasGeral` (remover parcela separada de parcerias)

4. **Atualizar tooltip do KPI "Total Captado"**: mostrar apenas "X em projetos + Y em bolsas"

5. **Atualizar card "Investimento em Formação"**: usar `totalBolsasGeral` na linha "Valor total em bolsas" e no cálculo de proporção

6. **Manter o card "Parcerias Ativas"** nos KPIs (informação de contagem continua útil), mas o tooltip pode mostrar o valor total sem duplicar no total captado

