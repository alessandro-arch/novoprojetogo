import { Badge } from "@/components/ui/badge";

const FonteBadge = ({ slug, nome }: { slug?: string | null; nome?: string | null }) => {
  const fonte = slug?.toLowerCase();
  const variant = fonte === "cnpq" ? "fonteCnpq" : fonte === "fapes" ? "fonteFapes" : "secondary";
  return <Badge variant={variant}>{nome || slug || "Fonte"}</Badge>;
};

export default FonteBadge;