import { FileText } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-[hsl(220,25%,12%)] py-14">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10 mb-10">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <FileText className="w-5 h-5 text-white/70" />
              <span className="text-base font-bold font-heading text-white">
                ProjetoGO
              </span>
            </div>
            <p className="text-white/50 text-sm leading-relaxed max-w-sm">
              Plataforma de gestão de editais, propostas e avaliações.
              Uma solução InnovaGO.
            </p>
          </div>

          {/* Links */}
          <div>
            <h4 className="text-sm font-semibold text-white/80 mb-4 uppercase tracking-wider">
              Produto
            </h4>
            <ul className="space-y-2 text-sm text-white/50">
              <li><a href="/login" className="hover:text-white/80 transition-colors">Acessar Portal</a></li>
              <li><a href="/register" className="hover:text-white/80 transition-colors">Cadastro de Proponente</a></li>
              <li><a href="/login?role=admin" className="hover:text-white/80 transition-colors">Acesso Administrativo</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 pt-6">
          <p className="text-white/40 text-xs text-center">
            © {new Date().getFullYear()} ProjetoGO — Powered by InnovaGO. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
