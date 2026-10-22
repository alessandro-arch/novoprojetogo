import { Badge } from "@/components/ui/badge";
import { varianteFonte } from "@/lib/operon-fontes";

const FonteBadge = ({ slug, nome }: { slug?: string | null; nome?: string | null }) => {
  return <Badge variant={varianteFonte(slug)}>{nome || slug || "Fonte"}</Badge>;
};

export default FonteBadge;