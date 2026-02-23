import { FileText, Mail, Globe, Lock } from "lucide-react";

const Footer = () => {
  return (
    <footer className="bg-[hsl(220,25%,12%)]">
      {/* Main footer content */}
      <div className="container mx-auto px-4 pt-14 pb-10">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2.5 mb-3">
              <FileText className="w-5 h-5 text-white/70" />
              <span className="text-base font-bold font-heading text-white">
                ProjetoGO
              </span>
            </div>
            <p className="text-white/45 text-sm leading-relaxed mb-6">
              Plataforma para gestão de editais, propostas e avaliações de projetos de Pesquisa, Desenvolvimento e Inovação (PD&I).
            </p>
            <span className="text-xs font-semibold text-white/60 uppercase tracking-wider">
              InnovaGO
            </span>
          </div>

          {/* Produto */}
          <div>
            <h4 className="text-sm font-semibold text-white/80 mb-4">Produto</h4>
            <ul className="space-y-2.5 text-sm text-white/45">
              <li><a href="/login" className="hover:text-white/80 transition-colors">Acessar Portal</a></li>
              <li><a href="/register" className="hover:text-white/80 transition-colors">Cadastro de Proponente</a></li>
              <li><a href="/login?role=admin" className="hover:text-white/80 transition-colors">Acesso Administrativo</a></li>
            </ul>
          </div>

          {/* Contato */}
          <div>
            <h4 className="text-sm font-semibold text-white/80 mb-4">Contato</h4>
            <ul className="space-y-2.5 text-sm text-white/45">
              <li className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-white/35" />
                <span>contato@innovago.app</span>
              </li>
              <li className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-white/35" />
                <a href="https://www.innovago.app" target="_blank" rel="noopener noreferrer" className="hover:text-white/80 transition-colors">
                  www.innovago.app
                </a>
              </li>
            </ul>
          </div>

          {/* Institucional */}
          <div>
            <h4 className="text-sm font-semibold text-white/80 mb-4">Institucional</h4>
            <ul className="space-y-2.5 text-sm text-white/45">
              <li><span className="cursor-default">Perguntas Frequentes</span></li>
              <li><span className="cursor-default">Política de Privacidade</span></li>
              <li><span className="cursor-default">LGPD</span></li>
            </ul>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="border-t border-white/10 pt-6 space-y-2">
          <div className="flex items-center gap-2 text-white/35 text-xs">
            <Lock className="w-3.5 h-3.5" />
            <span>Criptografia AES-256-GCM · SHA-256 · TLS 1.3 · Dados protegidos</span>
          </div>
          <p className="text-white/35 text-xs">
            © {new Date().getFullYear()} ProjetoGO. Todos os direitos reservados.
          </p>
          <p className="text-white/45 text-xs">
            Uma solução <span className="font-semibold text-white/60">InnovaGO</span>
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
