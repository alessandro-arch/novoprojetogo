

## Correção do parsing da resposta da API Anthropic

### Problema
O parsing atual (`JSON.parse(text)`) falha quando o modelo retorna JSON envolto em markdown (` ```json ... ``` `) ou com texto extra antes/depois do objeto JSON.

### Alteração
**Arquivo:** `src/components/fomento/FomentoProjectForm.tsx` (linhas 250-252)

Substituir:
```typescript
const result = await response.json();
const text = result.content?.[0]?.text || "";
const parsed = JSON.parse(text);
```

Por:
```typescript
const data = await response.json();
const rawText = data.content
  .map((block: any) => block.text || '')
  .join('');
const cleaned = rawText
  .replace(/```json\s*/gi, '')
  .replace(/```\s*/g, '')
  .trim();
const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
if (!jsonMatch) throw new Error('Nenhum JSON válido encontrado na resposta');
const parsed = JSON.parse(jsonMatch[0]);
```

Este é o único local no módulo Fomento onde a resposta da API Anthropic é parseada.

