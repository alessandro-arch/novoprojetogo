import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { readSheet, reconcileStudents, reconcileFaculty, Row } from "@/lib/sd-import";

const programs = [
  { id: "p-arq", name: "Arquitetura e Cidade" }, { id: "p-af", name: "Assistência Farmacêutica" },
  { id: "p-bio", name: "Biotecnologia Vegetal" }, { id: "p-ca", name: "Ciência Animal" },
  { id: "p-cf", name: "Ciências Farmacêuticas" }, { id: "p-seg", name: "Segurança Pública" },
];
const xlsx = (rows: any[][]) => {
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "S");
  return XLSX.write(wb, { type: "array", bookType: "xlsx" }) as ArrayBuffer;
};
// in-memory equivalent of "Confirmar importação": writes valid rows, flags absent, never inactivates
const apply = (db: any[], rows: Row[]) => {
  rows.filter((r) => ["novo", "alterado", "sem_alteracao"].includes(r.outcome)).forEach((r) => {
    const cur = db.find((x) => x.enrollment === r.enrollment);
    if (cur) Object.assign(cur, r.data, { absent_in_last_import: false });
    else db.push({ id: "id-" + r.enrollment, ...r.data, absent_in_last_import: false });
  });
  rows.filter((r) => r.outcome === "ausente").forEach((r) => (db.find((x) => x.id === r.before.id).absent_in_last_import = true));
};
const by = (rows: Row[], o: string) => rows.filter((r) => r.outcome === o);

describe("Homologação Fase 2 — importação", () => {
  const faculty: any[] = []; const links: any[] = []; const students: any[] = [];

  it("professores: CLT, PJ, orientador, multi-programa, duplicado", () => {
    const sheet = readSheet(xlsx([
      ["Matrícula", "Nome", "Contrato", "Início do vínculo", "Programas", "Pode orientar", "Situação"],
      ["P1", "Ana CLT", "CLT", "", "Ciência Animal", "Sim", "Ativo"],
      ["P2", "Bruno PJ", "PJ", "01/03/2025", "Biotecnologia Vegetal", "Não", "Ativo"],
      ["P3", "Carla Multi", "CLT", "", "Ciências Farmacêuticas; Assistência Farmacêutica", "Sim", "Ativo"],
      ["P1", "Ana Duplicada", "CLT", "", "Ciência Animal", "Sim", "Ativo"],
      ["P4", "Davi", "TEMPORARIO", "", "Ciência Animal", "Sim", "Ativo"],
    ]));
    const r = reconcileFaculty(sheet, { programs, existing: faculty, links, contracts: ["CLT", "PJ"] });
    expect(by(r, "novo").map((x) => x.enrollment)).toEqual(["P1", "P2", "P3"]);
    expect(by(r, "erro").map((x) => x.message)).toEqual(["matrícula repetida no arquivo", "tipo de contrato não configurado: TEMPORARIO"]);
    expect(r.find((x) => x.enrollment === "P2")!.data).toMatchObject({ contract_type: "PJ", bond_start: "2025-03-01", can_advise: false });
    expect(r.find((x) => x.enrollment === "P3")!.extra.progIds).toEqual(["p-cf", "p-af"]);
    apply(faculty, r);
    r.forEach((x) => (x.extra?.progIds || []).forEach((p: string) => links.push({ faculty_id: "id-" + x.enrollment, program_id: p })));
    expect(faculty).toHaveLength(3); // inconsistentes ficaram de fora, válidos gravados
  });

  it("alunos semestre 1: Mestrado, Doutorado, orientador inexistente, orientador não habilitado", () => {
    const sheet = readSheet(xlsx([
      ["Matrícula", "Nome", "Programa", "Nível", "Ingresso", "Orientador", "Situação"],
      ["A1", "Eva", "Ciência Animal", "Mestrado", "01/03/2026", "P1", "Ativo"],
      ["A2", "Fábio", "Ciências Farmacêuticas", "Doutorado", "2025-08-01", "Carla Multi", "Ativo"],
      ["A3", "Gil", "Ciência Animal", "Mestrado", "01/03/2026", "P999", "Ativo"],
      ["A4", "Hugo", "Biotecnologia Vegetal", "Mestrado", "01/03/2026", "P2", "Ativo"],
      ["A5", "Íris", "Ciência Animal", "Mestrado", "01/03/2026", "", "Ativo"],
    ]));
    const r = reconcileStudents(sheet, { programs, existing: students, faculty });
    expect(by(r, "novo").map((x) => x.enrollment)).toEqual(["A1", "A2", "A5"]);
    expect(r.find((x) => x.enrollment === "A3")!.message).toContain("orientador não encontrado");
    expect(r.find((x) => x.enrollment === "A4")!.message).toContain("não habilitado como orientador");
    expect(r.find((x) => x.enrollment === "A2")!.data).toMatchObject({ level: "doutorado", advisor_id: "id-P3", entry_date: "2025-08-01" });
    apply(students, r);
  });

  it("alunos semestre 2: mudança de orientador, atualização, ausente não inativado", () => {
    const sheet = readSheet(xlsx([
      ["Matrícula", "Nome", "Programa", "Nível", "Ingresso", "Orientador", "Situação"],
      ["A1", "Eva Souza", "Ciência Animal", "Mestrado", "01/03/2026", "P3", "Ativo"],
      ["A2", "Fábio", "Ciências Farmacêuticas", "Doutorado", "2025-08-01", "Carla Multi", "Ativo"],
    ]));
    const r = reconcileStudents(sheet, { programs, existing: students, faculty });
    const a1 = r.find((x) => x.enrollment === "A1")!;
    expect(a1.outcome).toBe("alterado");
    expect(a1.diffs).toEqual(["full_name", "advisor_id"]);
    expect(r.find((x) => x.enrollment === "A2")!.outcome).toBe("sem_alteracao");
    expect(by(r, "ausente").map((x) => x.enrollment)).toEqual(["A5"]);
    apply(students, r);
    const a5 = students.find((s) => s.enrollment === "A5");
    expect(a5.status).toBe("ativo");
    expect(a5.absent_in_last_import).toBe(true);
    expect(students.find((s) => s.enrollment === "A1").advisor_id).toBe("id-P3");
  });

  it("professores semestre 2: PJ renovado e novo programa identificados como alteração", () => {
    const sheet = readSheet(xlsx([
      ["Matrícula", "Nome", "Contrato", "Início do vínculo", "Programas", "Pode orientar", "Situação"],
      ["P1", "Ana CLT", "CLT", "", "Ciência Animal; Segurança Pública", "Sim", "Ativo"],
      ["P2", "Bruno PJ", "PJ", "01/03/2027", "Biotecnologia Vegetal", "Sim", "Ativo"],
    ]));
    const r = reconcileFaculty(sheet, { programs, existing: faculty, links, contracts: ["CLT", "PJ"] });
    expect(r.find((x) => x.enrollment === "P1")!.diffs).toEqual(["programas"]);
    expect(r.find((x) => x.enrollment === "P2")!.diffs).toEqual(["bond_start", "can_advise"]);
    expect(by(r, "ausente").map((x) => x.enrollment)).toEqual(["P3"]);
  });

  it("professores: layout institucional de cinco colunas, PJ automático e linhas repetidas", () => {
    const sheet = readSheet(xlsx([
      [],
      ["TIPO de Vínculo", "Matricula", "Nome", "Programa", "Vínculo"],
      ["Pessoa Jurídica", "PJ", "Agda Regina de Carvalho", "PPGAC", "Permanente"],
      ["Pessoa Jurídica", "PJ", "Agda Regina de Carvalho", "PPGAC", "Permanente"],
      ["CLT", "4326", "Alessandro Coutinho Ramos", "PPGCF", "Colaborador (a)"],
    ]));
    const fixed = { id: "p-arq", name: "Arquitetura e Cidade", sigla: "PPGAC" };
    const r = reconcileFaculty(sheet, { programs: [...programs, fixed], fixedProg: fixed, existing: [], links: [], contracts: ["CLT", "PJ"] });
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ enrollment: "PJ-AGDA-REGINA-DE-CARVALHO", outcome: "novo", data: { contract_type: "PJ", can_advise: true } });
    expect(r[0].extra.links).toEqual([{ programId: "p-arq", relationshipType: "Permanente" }]);
  });
});
