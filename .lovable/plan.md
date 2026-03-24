

## Plano: Adicionar card de Parcerias no Dashboard

Adicionar um card KPI no dashboard superior mostrando o número de parcerias ativas e o valor total captado em parcerias.

### Alterações em `src/components/fomento/FomentoDashboardView.tsx`

1. **Nova query**: Buscar dados de `fomento_parcerias` (mesmo padrão das queries existentes, filtrando por `organization_id`)

2. **Cálculo**: Filtrar parcerias ativas (`status === 'ativa'`), somar `valor_total`

3. **Novo KPI**: Inserir na array `kpis` (após "Bolsas Doutorado") um card "Parcerias" com ícone `Handshake`, mostrando o número de parcerias ativas e o valor total no tooltip

4. **Import**: Adicionar `Handshake` ao import de lucide-react

5. **Atualizar `totalCaptado`**: Somar o valor das parcerias ao total captado geral (projetos + bolsas + parcerias), atualizando também o tooltip do card "Total Captado"

