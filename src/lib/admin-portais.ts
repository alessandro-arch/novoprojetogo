/** Navigation only: each destination retains its existing admission gate. */
export function portaisAdministrativos(globalRole: string | null, fomentoRole: string | null) {
  const portais: { nome: string; destino: string; icone: "projeto" | "fomento" | "operon" | "sd" }[] = [];
  if (globalRole === "icca_admin") {
    portais.push({ nome: "ProjetoGO", destino: "/admin", icone: "projeto" });
  }
  if (fomentoRole === "superadmin") {
    portais.push({ nome: "ProjetoGO Fomento", destino: "/fomento/organizacoes", icone: "fomento" });
  }
  if (globalRole === "icca_admin") {
    portais.push({ nome: "Operon Editais", destino: "/editais/curadoria", icone: "operon" });
    portais.push({ nome: "Service Desk", destino: "/servicedesk/admin", icone: "sd" });
  }
  return portais;
}