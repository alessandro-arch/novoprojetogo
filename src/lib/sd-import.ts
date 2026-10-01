import * as XLSX from "xlsx";

export type Outcome = "novo" | "alterado" | "sem_alteracao" | "ausente" | "erro";
export interface Row { line: number; enrollment: string; outcome: Outcome; data?: any; before?: any; message?: string; diffs?: string[]; extra?: any; }

export const norm = (s: any) => String(s ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const ALIASES: Record<string, string[]> = {
  enrollment: ["matricula", "registro", "id"], full_name: ["nome", "nome_completo", "nome_do_aluno", "nome_do_a_aluno_a", "nome_do_professor"], program: ["programa", "ppg"],
  level: ["nivel", "curso"], entry_date: ["ingresso", "data_ingresso", "data_de_ingresso", "inicio_no_curso"], advisor: ["orientador", "orientador_a", "orientadora", "matricula_orientador"],
  status: ["situacao", "status"], contract_type: ["tipo_de_vinculo", "tipo_vinculo", "contrato", "tipo_contrato", "tipo_de_contrato"], bond_start: ["inicio", "inicio_vinculo", "inicio_do_vinculo", "data_inicio"],
  programs: ["programas", "programa", "ppg"], can_advise: ["pode_orientar"],
  relationship_type: ["vinculo"],
  cpf: ["cpf"], phone: ["telefone", "celular", "fone"], email: ["email", "e_mail"], turma: ["turma"],
  expected_end: ["termino_previsto_data_de_conclusao", "termino_previsto", "termino", "data_de_conclusao", "previsao_de_termino"],
  scholarship: ["bolsa", "bolsista"],
};
const pick = (row: Record<string, any>, field: string) => { for (const a of ALIASES[field]) if (row[a] !== undefined && row[a] !== "") return row[a]; return undefined; };
export const parseDate = (v: any): string | null | "invalid" => {
  if (v === undefined || v === null || v === "") return null;
  if (v instanceof Date) return isNaN(v.getTime()) ? "invalid" : `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  if (typeof v === "number") { const d = XLSX.SSF.parse_date_code(v); return d ? `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}` : "invalid"; }
  const s = String(v).trim(); let m;
  if ((m = s.match(/^(\d{1,2})[\/.\-](\d{1,2})[\/.\-](\d{4})$/))) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  if ((m = s.match(/^(\d{4})-(\d{2})-(\d{2})/))) return `${m[1]}-${m[2]}-${m[3]}`;
  return "invalid";
};
const yes = (v: any) => ["sim", "s", "x", "true", "1", "yes"].includes(norm(v));
const mapStatus = (v: any, allowed: string[]) => { const n = norm(v || "ativo"); const m: Record<string, string> = { ativa: "ativo", inativa: "inativo", concluida: "concluido", desligada: "desligado", trancada: "trancado", cursando: "ativo", matriculado: "ativo", matriculada: "ativo" }; const r = m[n] || n; return allowed.includes(r) ? r : null; };

export const readSheet = (buf: ArrayBuffer) => {
  const wb = XLSX.read(buf, { cellDates: true });
  const name = wb.SheetNames.find((n) => norm(n) === "ativos") ?? wb.SheetNames[0];
  const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, defval: "" });
  const isEnr = (c: any) => ["matricula", "registro"].includes(norm(c));
  let h = rows.findIndex((r) => r.some(isEnr) && r.some((c) => norm(c).startsWith("nome")));
  if (h < 0) h = 0;
  const keys = (rows[h] ?? []).map(norm);
  return rows.slice(h + 1).map((r, i) => {
    const o: Record<string, any> = { __line: h + i + 2 };
    keys.forEach((k, j) => { if (k && o[k] === undefined) o[k] = typeof r[j] === "string" ? r[j].trim() : r[j]; });
    return o;
  }).filter((o) => keys.some((k) => k && o[k] !== "" && o[k] !== undefined));
};

const progIndex = (programs: any[]) => { const m = new Map<string, any>(); programs.forEach((p) => { m.set(norm(p.name), p); if (p.sigla) m.set(norm(p.sigla), p); }); return m; };

export function reconcileStudents(sheet: any[], ctx: { programs: any[]; fixedProg?: any; existing: any[]; faculty: any[] }): Row[] {
  const { fixedProg } = ctx; const progByName = progIndex(ctx.programs);
  const byEnr = new Map<string, any>(ctx.existing.map((s) => [s.enrollment, s]));
  const advByEnr = new Map<string, any>(ctx.faculty.map((f) => [String(f.enrollment), f]));
  const advByName = new Map<string, any>(ctx.faculty.map((f) => [norm(f.full_name), f]));
  const seen = new Set<string>(); const out: Row[] = [];
  sheet.forEach((r, i) => {
    const line = r.__line ?? i + 2; const enrollment = String(pick(r, "enrollment") ?? "").trim(); const errs: string[] = [];
    if (!enrollment) errs.push("matrícula vazia"); else if (seen.has(enrollment)) errs.push("matrícula repetida no arquivo"); seen.add(enrollment);
    const full_name = String(pick(r, "full_name") ?? "").trim(); if (!full_name) errs.push("nome vazio");
    const progRaw = pick(r, "program"); const prog = progRaw ? progByName.get(norm(progRaw)) : fixedProg;
    if (!prog) errs.push(progRaw ? `programa não cadastrado: ${progRaw}` : "programa não informado");
    else if (fixedProg && prog.id !== fixedProg.id) errs.push(`programa diferente do selecionado: ${progRaw}`);
    const lv = norm(pick(r, "level")); const level = lv.startsWith("mest") || lv === "ms" ? "mestrado" : lv.startsWith("dout") || lv === "dr" ? "doutorado" : null;
    if (!level) errs.push("nível deve ser Mestrado ou Doutorado");
    const entry_date = parseDate(pick(r, "entry_date")); if (entry_date === "invalid") errs.push("data de ingresso inválida");
    const advRaw = pick(r, "advisor"); let advisor_id: string | null = null;
    if (advRaw) {
      const a = advByEnr.get(String(advRaw).trim()) || advByName.get(norm(advRaw));
      if (!a) errs.push(`orientador não encontrado na base de professores: ${advRaw}`);
      else if (!a.can_advise) errs.push(`professor não habilitado como orientador: ${advRaw}`);
      else advisor_id = a.id;
    }
    const status = mapStatus(pick(r, "status"), ["ativo", "inativo", "trancado", "concluido", "desligado"]); if (!status) errs.push("situação inválida");
    const expected_end = parseDate(pick(r, "expected_end")); if (expected_end === "invalid") errs.push("término previsto inválido");
    const cpfDigits = String(pick(r, "cpf") ?? "").replace(/\D/g, ""); if (cpfDigits && cpfDigits.length !== 11) errs.push("CPF inválido");
    if (errs.length) { out.push({ line, enrollment, outcome: "erro", message: errs.join("; ") }); return; }
    const phone = String(pick(r, "phone") ?? "").replace(/[^\d+()\- ]/g, "").trim() || null;
    const email = String(pick(r, "email") ?? "").trim().toLowerCase() || null;
    const turma = String(pick(r, "turma") ?? "").trim() || null;
    const scholarship = String(pick(r, "scholarship") ?? "").trim() || null;
    const data = { enrollment, full_name, program_id: prog.id, level, entry_date, advisor_id, status, expected_end, cpf_digits: cpfDigits || null, phone, email, turma, scholarship };
    const before = byEnr.get(enrollment);
    if (!before) { out.push({ line, enrollment, outcome: "novo", data }); return; }
    const diffs: string[] = (["full_name", "program_id", "level", "entry_date", "advisor_id", "status", "expected_end", "phone", "email", "turma", "scholarship"] as const).filter((k) => (before[k] ?? null) !== (data[k] ?? null));
    if (cpfDigits && before.cpf_last4 && cpfDigits.slice(-4) !== before.cpf_last4) diffs.push("cpf");
    out.push({ line, enrollment, outcome: diffs.length ? "alterado" : "sem_alteracao", data, before, diffs });
  });
  ctx.existing.filter((s) => !seen.has(s.enrollment) && (!fixedProg || s.program_id === fixedProg.id) && s.status === "ativo")
    .forEach((s) => out.push({ line: 0, enrollment: s.enrollment, outcome: "ausente", before: s, message: s.full_name }));
  return out;
}

export function reconcileFaculty(sheet: any[], ctx: { programs: any[]; fixedProg?: any; existing: any[]; links: any[]; contracts: string[] }): Row[] {
  const { fixedProg, contracts } = ctx; const progByName = progIndex(ctx.programs);
  const byEnr = new Map<string, any>(ctx.existing.map((s) => [s.enrollment, s]));
  const seen = new Set<string>(); const seenRows = new Set<string>(); const out: Row[] = [];
  sheet.forEach((r, i) => {
    const line = r.__line ?? i + 2; const enrollment = String(pick(r, "enrollment") ?? "").trim(); const errs: string[] = [];
    const full_name = String(pick(r, "full_name") ?? "").trim(); if (!full_name) errs.push("nome vazio");
    const contractRaw = String(pick(r, "contract_type") ?? "").trim();
    const contractNorm = norm(contractRaw);
    const contract_type = contractNorm === "pessoa_juridica" || contractNorm === "pj" ? "PJ" : contractNorm === "clt" ? "CLT" : contractRaw.toUpperCase() || null;
    if (contract_type && contracts.length && !contracts.includes(contract_type)) errs.push(`tipo de contrato não configurado: ${ctRaw}`);
    const bond_start = parseDate(pick(r, "bond_start")); if (bond_start === "invalid") errs.push("data de início inválida");
    const progRaw = String(pick(r, "programs") ?? ""); const rowProg = progRaw ? progByName.get(norm(progRaw)) : null;
    if (progRaw && !rowProg) errs.push(`programa não cadastrado: ${progRaw}`);
    if (fixedProg && rowProg && rowProg.id !== fixedProg.id) return;
    const selectedProg = fixedProg || rowProg;
    if (!selectedProg) errs.push("programa não informado");
    const relationship_type = String(pick(r, "relationship_type") ?? "").trim() || null;
    const rowKey = `${enrollment}|${norm(full_name)}|${selectedProg?.id || norm(progRaw)}|${norm(relationship_type)}`;
    if (seenRows.has(rowKey)) return;
    seenRows.add(rowKey);
    const isPjPlaceholder = contract_type === "PJ" && (!enrollment || norm(enrollment) === "pj");
    const identity = isPjPlaceholder ? `PJ-${norm(full_name).toUpperCase().replace(/_/g, "-")}` : enrollment;
    if (!identity) errs.push("matrícula vazia");
    if (seen.has(identity)) {
      const previous = out.find((item) => item.enrollment === identity && item.outcome !== "erro");
      if (previous && selectedProg) {
        const link = { programId: selectedProg.id, relationshipType: relationship_type };
        previous.extra.links = [...(previous.extra.links || []), link];
        previous.extra.progIds = [...new Set([...(previous.extra.progIds || []), selectedProg.id])];
      }
      return;
    }
    seen.add(identity);
    const status = mapStatus(pick(r, "status"), ["ativo", "inativo"]); if (!status) errs.push("situação inválida");
    const advRaw = pick(r, "can_advise");
    if (errs.length) { out.push({ line, enrollment: identity, outcome: "erro", message: errs.join("; ") }); return; }
    const before = byEnr.get(identity);
    const data: any = { enrollment: identity, full_name, contract_type, bond_start, status, can_advise: advRaw !== undefined ? yes(advRaw) : before?.can_advise ?? true };
    const curProgs = before ? ctx.links.filter((x) => x.faculty_id === before.id).map((x) => x.program_id) : [];
    const progIds = selectedProg ? [selectedProg.id] : [];
    const newProgs = progIds.filter((p) => !curProgs.includes(p));
    const links = selectedProg ? [{ programId: selectedProg.id, relationshipType: relationship_type }] : [];
    if (!before) { out.push({ line, enrollment: identity, outcome: "novo", data, extra: { progIds, links } }); return; }
    const diffs: string[] = (["full_name", "contract_type", "bond_start", "status", "can_advise"] as const).filter((k) => (before[k] ?? null) !== (data[k] ?? null));
    const currentLink = selectedProg ? ctx.links.find((x) => x.faculty_id === before.id && x.program_id === selectedProg.id) : null;
    if (newProgs.length || (currentLink && (currentLink.relationship_type ?? null) !== relationship_type)) diffs.push("programas");
    out.push({ line, enrollment: identity, outcome: diffs.length ? "alterado" : "sem_alteracao", data, before, diffs, extra: { progIds: newProgs, links } });
  });
  const inScope = (f: any) => !fixedProg || ctx.links.some((x) => x.faculty_id === f.id && x.program_id === fixedProg.id);
  ctx.existing.filter((f) => !seen.has(f.enrollment) && f.status === "ativo" && inScope(f))
    .forEach((f) => out.push({ line: 0, enrollment: f.enrollment, outcome: "ausente", before: f, message: f.full_name }));
  return out;
}
