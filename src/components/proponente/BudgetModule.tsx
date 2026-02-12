import { useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";

// ── Types ──

export interface BudgetLineBase {
  order: number;
  justificativa: string;
  mes: string;
}

export interface DiariasLine extends BudgetLineBase {
  localidade: string;
  quantidade: number;
  custoUnitario: number;
}

export interface PassagensLine extends BudgetLineBase {
  trecho: string;
  quantidade: number;
  custoUnitario: number;
}

export interface MaterialConsumoLine extends BudgetLineBase {
  especificacao: string;
  quantidade: number;
  unidade: string;
  custoUnitario: number;
}

export interface ServicosTerceirosLine extends BudgetLineBase {
  tipo: "pf" | "pj";
  especificacao: string;
  custoTotal: number;
}

export interface MateriaisPermanentesLine extends BudgetLineBase {
  especificacao: string;
  quantidade: number;
  custoUnitario: number;
}

export interface BolsasLine extends BudgetLineBase {
  modalidade: string;
  quantidade: number;
  duracaoMeses: number;
  custoUnitarioMensal: number;
  periodo: string;
}

export interface BudgetData {
  diarias: DiariasLine[];
  passagens: PassagensLine[];
  materialConsumo: MaterialConsumoLine[];
  servicosTerceiros: ServicosTerceirosLine[];
  materiaisPermanentes: MateriaisPermanentesLine[];
  bolsas: BolsasLine[];
}

export const emptyBudget: BudgetData = {
  diarias: [],
  passagens: [],
  materialConsumo: [],
  servicosTerceiros: [],
  materiaisPermanentes: [],
  bolsas: [],
};

// ── Helpers ──

const fmt = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const CurrencyInput = ({
  value,
  onChange,
  disabled,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  placeholder?: string;
}) => (
  <Input
    type="number"
    min={0}
    step={0.01}
    value={value || ""}
    onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
    disabled={disabled}
    placeholder={placeholder || "0,00"}
    className="w-28"
  />
);

const NumberInput = ({
  value,
  onChange,
  disabled,
  className,
}: {
  value: number;
  onChange: (v: number) => void;
  disabled?: boolean;
  className?: string;
}) => (
  <Input
    type="number"
    min={0}
    value={value || ""}
    onChange={(e) => onChange(parseInt(e.target.value) || 0)}
    disabled={disabled}
    className={className || "w-20"}
  />
);

// ── Main Component ──

interface BudgetModuleProps {
  value: BudgetData;
  onChange: (data: BudgetData) => void;
  disabled?: boolean;
}

const BudgetModule = ({ value, onChange, disabled }: BudgetModuleProps) => {
  const data = { ...emptyBudget, ...value };

  const update = useCallback(
    <K extends keyof BudgetData>(key: K, lines: BudgetData[K]) => {
      onChange({ ...data, [key]: lines });
    },
    [data, onChange]
  );

  // ── Diárias ──
  const diariasTotal = data.diarias.reduce(
    (s, l) => s + l.quantidade * l.custoUnitario,
    0
  );

  // ── Passagens ──
  const passagensTotal = data.passagens.reduce(
    (s, l) => s + l.quantidade * l.custoUnitario,
    0
  );

  // ── Material Consumo ──
  const materialTotal = data.materialConsumo.reduce(
    (s, l) => s + l.quantidade * l.custoUnitario,
    0
  );

  // ── Serviços Terceiros ──
  const servicosTotal = data.servicosTerceiros.reduce(
    (s, l) => s + l.custoTotal,
    0
  );

  // ── Materiais Permanentes ──
  const permanentesTotal = data.materiaisPermanentes.reduce(
    (s, l) => s + l.quantidade * l.custoUnitario,
    0
  );

  // ── Bolsas ──
  const bolsasTotal = data.bolsas.reduce(
    (s, l) => s + l.quantidade * l.duracaoMeses * l.custoUnitarioMensal,
    0
  );

  const grandTotal =
    diariasTotal +
    passagensTotal +
    materialTotal +
    servicosTotal +
    permanentesTotal +
    bolsasTotal;

  return (
    <div className="space-y-6">
      {/* 1) Diárias */}
      <RubricaCard
        title="1. Diárias"
        total={diariasTotal}
        onAdd={
          disabled
            ? undefined
            : () =>
                update("diarias", [
                  ...data.diarias,
                  {
                    order: data.diarias.length + 1,
                    localidade: "",
                    quantidade: 1,
                    custoUnitario: 0,
                    mes: "",
                    justificativa: "",
                  },
                ])
        }
      >
        {data.diarias.length === 0 && <EmptyRow />}
        {data.diarias.map((line, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_80px_120px_120px_80px_1fr_40px] gap-2 items-start"
          >
            <Input
              value={line.localidade}
              onChange={(e) => {
                const arr = [...data.diarias];
                arr[i] = { ...arr[i], localidade: e.target.value };
                update("diarias", arr);
              }}
              placeholder="Localidade"
              disabled={disabled}
            />
            <NumberInput
              value={line.quantidade}
              onChange={(v) => {
                const arr = [...data.diarias];
                arr[i] = { ...arr[i], quantidade: v };
                update("diarias", arr);
              }}
              disabled={disabled}
            />
            <CurrencyInput
              value={line.custoUnitario}
              onChange={(v) => {
                const arr = [...data.diarias];
                arr[i] = { ...arr[i], custoUnitario: v };
                update("diarias", arr);
              }}
              disabled={disabled}
            />
            <span className="text-sm font-medium flex items-center h-10 px-2 bg-muted/50 rounded-md border border-border">
              {fmt(line.quantidade * line.custoUnitario)}
            </span>
            <Input
              value={line.mes}
              onChange={(e) => {
                const arr = [...data.diarias];
                arr[i] = { ...arr[i], mes: e.target.value };
                update("diarias", arr);
              }}
              placeholder="Mês"
              disabled={disabled}
            />
            <Input
              value={line.justificativa}
              onChange={(e) => {
                const arr = [...data.diarias];
                arr[i] = { ...arr[i], justificativa: e.target.value };
                update("diarias", arr);
              }}
              placeholder="Justificativa *"
              disabled={disabled}
            />
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() =>
                  update(
                    "diarias",
                    data.diarias.filter((_, j) => j !== i)
                  )
                }
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
        <ColumnHeaders
          cols={[
            "Localidade",
            "Qtd",
            "Custo unit.",
            "Total",
            "Mês",
            "Justificativa",
            "",
          ]}
        />
      </RubricaCard>

      {/* 2) Passagens Aéreas */}
      <RubricaCard
        title="2. Passagens Aéreas"
        total={passagensTotal}
        onAdd={
          disabled
            ? undefined
            : () =>
                update("passagens", [
                  ...data.passagens,
                  {
                    order: data.passagens.length + 1,
                    trecho: "",
                    quantidade: 1,
                    custoUnitario: 0,
                    mes: "",
                    justificativa: "",
                  },
                ])
        }
      >
        {data.passagens.length === 0 && <EmptyRow />}
        {data.passagens.map((line, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_80px_120px_120px_80px_1fr_40px] gap-2 items-start"
          >
            <Input
              value={line.trecho}
              onChange={(e) => {
                const arr = [...data.passagens];
                arr[i] = { ...arr[i], trecho: e.target.value };
                update("passagens", arr);
              }}
              placeholder="Trecho (ex: GYN→BSB)"
              disabled={disabled}
            />
            <NumberInput
              value={line.quantidade}
              onChange={(v) => {
                const arr = [...data.passagens];
                arr[i] = { ...arr[i], quantidade: v };
                update("passagens", arr);
              }}
              disabled={disabled}
            />
            <CurrencyInput
              value={line.custoUnitario}
              onChange={(v) => {
                const arr = [...data.passagens];
                arr[i] = { ...arr[i], custoUnitario: v };
                update("passagens", arr);
              }}
              disabled={disabled}
            />
            <span className="text-sm font-medium flex items-center h-10 px-2 bg-muted/50 rounded-md border border-border">
              {fmt(line.quantidade * line.custoUnitario)}
            </span>
            <Input
              value={line.mes}
              onChange={(e) => {
                const arr = [...data.passagens];
                arr[i] = { ...arr[i], mes: e.target.value };
                update("passagens", arr);
              }}
              placeholder="Mês"
              disabled={disabled}
            />
            <Input
              value={line.justificativa}
              onChange={(e) => {
                const arr = [...data.passagens];
                arr[i] = { ...arr[i], justificativa: e.target.value };
                update("passagens", arr);
              }}
              placeholder="Justificativa *"
              disabled={disabled}
            />
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() =>
                  update(
                    "passagens",
                    data.passagens.filter((_, j) => j !== i)
                  )
                }
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
        <ColumnHeaders
          cols={[
            "Trecho",
            "Qtd",
            "Custo unit.",
            "Total",
            "Mês",
            "Justificativa",
            "",
          ]}
        />
      </RubricaCard>

      {/* 3) Material de Consumo */}
      <RubricaCard
        title="3. Material de Consumo"
        total={materialTotal}
        onAdd={
          disabled
            ? undefined
            : () =>
                update("materialConsumo", [
                  ...data.materialConsumo,
                  {
                    order: data.materialConsumo.length + 1,
                    especificacao: "",
                    quantidade: 1,
                    unidade: "un",
                    custoUnitario: 0,
                    mes: "",
                    justificativa: "",
                  },
                ])
        }
      >
        {data.materialConsumo.length === 0 && <EmptyRow />}
        {data.materialConsumo.map((line, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_80px_80px_120px_120px_80px_1fr_40px] gap-2 items-start"
          >
            <Input
              value={line.especificacao}
              onChange={(e) => {
                const arr = [...data.materialConsumo];
                arr[i] = { ...arr[i], especificacao: e.target.value };
                update("materialConsumo", arr);
              }}
              placeholder="Especificação"
              disabled={disabled}
            />
            <NumberInput
              value={line.quantidade}
              onChange={(v) => {
                const arr = [...data.materialConsumo];
                arr[i] = { ...arr[i], quantidade: v };
                update("materialConsumo", arr);
              }}
              disabled={disabled}
            />
            <Input
              value={line.unidade}
              onChange={(e) => {
                const arr = [...data.materialConsumo];
                arr[i] = { ...arr[i], unidade: e.target.value };
                update("materialConsumo", arr);
              }}
              placeholder="un"
              disabled={disabled}
              className="w-20"
            />
            <CurrencyInput
              value={line.custoUnitario}
              onChange={(v) => {
                const arr = [...data.materialConsumo];
                arr[i] = { ...arr[i], custoUnitario: v };
                update("materialConsumo", arr);
              }}
              disabled={disabled}
            />
            <span className="text-sm font-medium flex items-center h-10 px-2 bg-muted/50 rounded-md border border-border">
              {fmt(line.quantidade * line.custoUnitario)}
            </span>
            <Input
              value={line.mes}
              onChange={(e) => {
                const arr = [...data.materialConsumo];
                arr[i] = { ...arr[i], mes: e.target.value };
                update("materialConsumo", arr);
              }}
              placeholder="Mês"
              disabled={disabled}
            />
            <Input
              value={line.justificativa}
              onChange={(e) => {
                const arr = [...data.materialConsumo];
                arr[i] = { ...arr[i], justificativa: e.target.value };
                update("materialConsumo", arr);
              }}
              placeholder="Justificativa *"
              disabled={disabled}
            />
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() =>
                  update(
                    "materialConsumo",
                    data.materialConsumo.filter((_, j) => j !== i)
                  )
                }
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
        <ColumnHeaders
          cols={[
            "Especificação",
            "Qtd",
            "Un.",
            "Custo unit.",
            "Total",
            "Mês",
            "Justificativa",
            "",
          ]}
        />
      </RubricaCard>

      {/* 4) Serviços de Terceiros */}
      <RubricaCard
        title="4. Serviços de Terceiros"
        total={servicosTotal}
        onAdd={
          disabled
            ? undefined
            : () =>
                update("servicosTerceiros", [
                  ...data.servicosTerceiros,
                  {
                    order: data.servicosTerceiros.length + 1,
                    tipo: "pj",
                    especificacao: "",
                    custoTotal: 0,
                    mes: "",
                    justificativa: "",
                  },
                ])
        }
      >
        {data.servicosTerceiros.length === 0 && <EmptyRow />}
        {data.servicosTerceiros.map((line, i) => (
          <div
            key={i}
            className="grid grid-cols-[120px_1fr_120px_80px_1fr_40px] gap-2 items-start"
          >
            <Select
              value={line.tipo}
              onValueChange={(v) => {
                const arr = [...data.servicosTerceiros];
                arr[i] = { ...arr[i], tipo: v as "pf" | "pj" };
                update("servicosTerceiros", arr);
              }}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pf">Pessoa Física</SelectItem>
                <SelectItem value="pj">Pessoa Jurídica</SelectItem>
              </SelectContent>
            </Select>
            <Input
              value={line.especificacao}
              onChange={(e) => {
                const arr = [...data.servicosTerceiros];
                arr[i] = { ...arr[i], especificacao: e.target.value };
                update("servicosTerceiros", arr);
              }}
              placeholder="Especificação"
              disabled={disabled}
            />
            <CurrencyInput
              value={line.custoTotal}
              onChange={(v) => {
                const arr = [...data.servicosTerceiros];
                arr[i] = { ...arr[i], custoTotal: v };
                update("servicosTerceiros", arr);
              }}
              disabled={disabled}
            />
            <Input
              value={line.mes}
              onChange={(e) => {
                const arr = [...data.servicosTerceiros];
                arr[i] = { ...arr[i], mes: e.target.value };
                update("servicosTerceiros", arr);
              }}
              placeholder="Mês"
              disabled={disabled}
            />
            <Input
              value={line.justificativa}
              onChange={(e) => {
                const arr = [...data.servicosTerceiros];
                arr[i] = { ...arr[i], justificativa: e.target.value };
                update("servicosTerceiros", arr);
              }}
              placeholder="Justificativa *"
              disabled={disabled}
            />
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() =>
                  update(
                    "servicosTerceiros",
                    data.servicosTerceiros.filter((_, j) => j !== i)
                  )
                }
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
        <ColumnHeaders
          cols={[
            "Tipo",
            "Especificação",
            "Custo total",
            "Mês",
            "Justificativa",
            "",
          ]}
        />
      </RubricaCard>

      {/* 5) Materiais Permanentes e Equipamentos */}
      <RubricaCard
        title="5. Materiais Permanentes e Equipamentos"
        total={permanentesTotal}
        onAdd={
          disabled
            ? undefined
            : () =>
                update("materiaisPermanentes", [
                  ...data.materiaisPermanentes,
                  {
                    order: data.materiaisPermanentes.length + 1,
                    especificacao: "",
                    quantidade: 1,
                    custoUnitario: 0,
                    mes: "",
                    justificativa: "",
                  },
                ])
        }
      >
        {data.materiaisPermanentes.length === 0 && <EmptyRow />}
        {data.materiaisPermanentes.map((line, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_80px_120px_120px_80px_1fr_40px] gap-2 items-start"
          >
            <Input
              value={line.especificacao}
              onChange={(e) => {
                const arr = [...data.materiaisPermanentes];
                arr[i] = { ...arr[i], especificacao: e.target.value };
                update("materiaisPermanentes", arr);
              }}
              placeholder="Especificação"
              disabled={disabled}
            />
            <NumberInput
              value={line.quantidade}
              onChange={(v) => {
                const arr = [...data.materiaisPermanentes];
                arr[i] = { ...arr[i], quantidade: v };
                update("materiaisPermanentes", arr);
              }}
              disabled={disabled}
            />
            <CurrencyInput
              value={line.custoUnitario}
              onChange={(v) => {
                const arr = [...data.materiaisPermanentes];
                arr[i] = { ...arr[i], custoUnitario: v };
                update("materiaisPermanentes", arr);
              }}
              disabled={disabled}
            />
            <span className="text-sm font-medium flex items-center h-10 px-2 bg-muted/50 rounded-md border border-border">
              {fmt(line.quantidade * line.custoUnitario)}
            </span>
            <Input
              value={line.mes}
              onChange={(e) => {
                const arr = [...data.materiaisPermanentes];
                arr[i] = { ...arr[i], mes: e.target.value };
                update("materiaisPermanentes", arr);
              }}
              placeholder="Mês"
              disabled={disabled}
            />
            <Input
              value={line.justificativa}
              onChange={(e) => {
                const arr = [...data.materiaisPermanentes];
                arr[i] = { ...arr[i], justificativa: e.target.value };
                update("materiaisPermanentes", arr);
              }}
              placeholder="Justificativa *"
              disabled={disabled}
            />
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() =>
                  update(
                    "materiaisPermanentes",
                    data.materiaisPermanentes.filter((_, j) => j !== i)
                  )
                }
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
        <ColumnHeaders
          cols={[
            "Especificação",
            "Qtd",
            "Custo unit.",
            "Total",
            "Mês",
            "Justificativa",
            "",
          ]}
        />
      </RubricaCard>

      {/* 6) Bolsas */}
      <RubricaCard
        title="6. Bolsas"
        total={bolsasTotal}
        onAdd={
          disabled
            ? undefined
            : () =>
                update("bolsas", [
                  ...data.bolsas,
                  {
                    order: data.bolsas.length + 1,
                    modalidade: "",
                    quantidade: 1,
                    duracaoMeses: 1,
                    custoUnitarioMensal: 0,
                    periodo: "",
                    mes: "",
                    justificativa: "",
                  },
                ])
        }
      >
        {data.bolsas.length === 0 && <EmptyRow />}
        {data.bolsas.map((line, i) => (
          <div
            key={i}
            className="grid grid-cols-[1fr_60px_60px_120px_120px_100px_1fr_40px] gap-2 items-start"
          >
            <Input
              value={line.modalidade}
              onChange={(e) => {
                const arr = [...data.bolsas];
                arr[i] = { ...arr[i], modalidade: e.target.value };
                update("bolsas", arr);
              }}
              placeholder="Modalidade"
              disabled={disabled}
            />
            <NumberInput
              value={line.quantidade}
              onChange={(v) => {
                const arr = [...data.bolsas];
                arr[i] = { ...arr[i], quantidade: v };
                update("bolsas", arr);
              }}
              disabled={disabled}
              className="w-full"
            />
            <NumberInput
              value={line.duracaoMeses}
              onChange={(v) => {
                const arr = [...data.bolsas];
                arr[i] = { ...arr[i], duracaoMeses: v };
                update("bolsas", arr);
              }}
              disabled={disabled}
              className="w-full"
            />
            <CurrencyInput
              value={line.custoUnitarioMensal}
              onChange={(v) => {
                const arr = [...data.bolsas];
                arr[i] = { ...arr[i], custoUnitarioMensal: v };
                update("bolsas", arr);
              }}
              disabled={disabled}
            />
            <span className="text-sm font-medium flex items-center h-10 px-2 bg-muted/50 rounded-md border border-border">
              {fmt(
                line.quantidade * line.duracaoMeses * line.custoUnitarioMensal
              )}
            </span>
            <Input
              value={line.periodo}
              onChange={(e) => {
                const arr = [...data.bolsas];
                arr[i] = { ...arr[i], periodo: e.target.value };
                update("bolsas", arr);
              }}
              placeholder="Período"
              disabled={disabled}
            />
            <Input
              value={line.justificativa}
              onChange={(e) => {
                const arr = [...data.bolsas];
                arr[i] = { ...arr[i], justificativa: e.target.value };
                update("bolsas", arr);
              }}
              placeholder="Justificativa *"
              disabled={disabled}
            />
            {!disabled && (
              <Button
                variant="ghost"
                size="icon"
                className="h-10 w-10"
                onClick={() =>
                  update(
                    "bolsas",
                    data.bolsas.filter((_, j) => j !== i)
                  )
                }
              >
                <Trash2 className="w-4 h-4 text-destructive" />
              </Button>
            )}
          </div>
        ))}
        <ColumnHeaders
          cols={[
            "Modalidade",
            "Qtd",
            "Meses",
            "Custo/mês",
            "Total",
            "Período",
            "Justificativa",
            "",
          ]}
        />
      </RubricaCard>

      {/* Grand Total */}
      <Card className="border-primary/30 bg-primary/5">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <span className="text-lg font-bold text-foreground">
              Total Geral do Orçamento
            </span>
            <span className="text-xl font-bold text-primary">
              {fmt(grandTotal)}
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3 text-sm">
            <SummaryBadge label="Diárias" value={diariasTotal} />
            <SummaryBadge label="Passagens" value={passagensTotal} />
            <SummaryBadge label="Material Consumo" value={materialTotal} />
            <SummaryBadge label="Serv. Terceiros" value={servicosTotal} />
            <SummaryBadge label="Mat. Permanentes" value={permanentesTotal} />
            <SummaryBadge label="Bolsas" value={bolsasTotal} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

// ── Sub-components ──

const RubricaCard = ({
  title,
  total,
  onAdd,
  children,
}: {
  title: string;
  total: number;
  onAdd?: () => void;
  children: React.ReactNode;
}) => (
  <Card>
    <CardHeader className="pb-3">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <Badge variant="secondary" className="font-mono text-xs">
          Subtotal: {fmt(total)}
        </Badge>
      </div>
    </CardHeader>
    <CardContent className="space-y-2">
      {children}
      {onAdd && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAdd}
          className="mt-2"
        >
          <Plus className="w-4 h-4 mr-1" /> Adicionar linha
        </Button>
      )}
    </CardContent>
  </Card>
);

const ColumnHeaders = ({ cols }: { cols: string[] }) => (
  <div
    className="grid gap-2 text-[11px] text-muted-foreground font-medium -mt-1 mb-1 order-first"
    style={{
      gridTemplateColumns: cols
        .map((_, i) =>
          i === cols.length - 1
            ? "40px"
            : cols.length === 7
            ? i === 0 || i === 5
              ? "1fr"
              : i === 1
              ? "80px"
              : "120px"
            : cols.length === 8
            ? i === 0 || i === 6
              ? "1fr"
              : i === 1 || i === 2
              ? i === 2
                ? "80px"
                : "80px"
              : "120px"
            : cols.length === 6
            ? i === 0
              ? "120px"
              : i === 1 || i === 4
              ? "1fr"
              : "120px"
            : "1fr"
        )
        .join(" "),
    }}
  >
    {cols.map((c, i) => (
      <span key={i}>{c}</span>
    ))}
  </div>
);

const EmptyRow = () => (
  <p className="text-sm text-muted-foreground text-center py-3">
    Nenhum item adicionado. Clique em "Adicionar linha" para começar.
  </p>
);

const SummaryBadge = ({
  label,
  value,
}: {
  label: string;
  value: number;
}) => (
  <div className="flex items-center justify-between p-2 rounded-md bg-background border border-border">
    <span className="text-muted-foreground">{label}</span>
    <span className="font-mono font-medium text-foreground">{fmt(value)}</span>
  </div>
);

export default BudgetModule;
