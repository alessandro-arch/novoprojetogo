/** Quem pode entrar no Service Desk após autenticar: superadmin, membro ativo da instituição,
 *  integrante de grupo de atendimento ou solicitante com acesso ativo (aluno, professor ou técnico). */
export interface SdLoginRows {
  isSuperadmin: boolean;
  memberships: number;
  groups: number;
  students: number;
  faculty: number;
  staff: number;
}

export const canEnterServiceDesk = (r: SdLoginRows): boolean =>
  r.isSuperadmin || r.memberships > 0 || r.groups > 0 || r.students > 0 || r.faculty > 0 || r.staff > 0;
