import { Link } from "react-router-dom";
import { Placeholder } from "@/components/servicedesk/sd-ui";
import { Button } from "@/components/ui/button";

export default function ColetasPage() {
  return <>
    <h1 className="text-2xl md:text-3xl font-bold font-heading">Saúde das coletas</h1>
    <Placeholder title="Em preparação" text="Os indicadores de coleta e de usuários dependem de uma consulta agregada ainda não aprovada. Nenhum dado pessoal é exibido aqui." />
    <Button asChild variant="outline"><Link to="/editais/curadoria">Ir para a Curadoria</Link></Button>
  </>;
}
