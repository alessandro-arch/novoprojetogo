import { Badge } from "@/components/ui/badge";
import { Flag, Globe, MapPin } from "lucide-react";

export const ABRANGENCIAS = [
  ["estadual", "Estadual"],
  ["nacional", "Nacional"],
  ["internacional", "Internacional"],
] as const;

export const correspondeAbrangencia = (valor: string | null | undefined, filtro: string): boolean =>
  filtro === "__none__" || (filtro === "a_definir" ? valor == null : valor === filtro);

const AbrangenciaBadge = ({ abrangencia, curadoria = false }: { abrangencia?: string | null; curadoria?: boolean }) => {
  const label = ABRANGENCIAS.find(([valor]) => valor === abrangencia)?.[1];
  if (!label) return curadoria && abrangencia == null
    ? <Badge variant="outline" className="border-dashed text-muted-foreground">Abrangência a definir</Badge>
    : null;
  const Icon = abrangencia === "estadual" ? MapPin : abrangencia === "nacional" ? Flag : Globe;
  return <Badge variant="outline" className="gap-1 text-muted-foreground"><Icon className="h-3 w-3 shrink-0" aria-hidden="true" />{label}</Badge>;
};

export default AbrangenciaBadge;