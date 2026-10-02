# Landing page pública VPN UVV

## Objetivo
Criar a página pública `/vpn-uvv`, exclusiva da Universidade Vila Velha, para explicar o acesso remoto ao Portal de Periódicos CAPES e conduzir alunos e professores ao Service Desk existente.

## Experiência e conteúdo
- Construir uma página clara, acadêmica e institucional com a paleta azul do ProjetoGO, bastante espaço em branco e tipografia de alta legibilidade.
- Criar cabeçalho fixo e compacto, navegação por seções e menu adaptado para celular.
- Apresentar uma abertura marcante com o nome do serviço, público elegível e os botões “Solicitar acesso VPN” e “Primeiro acesso”.
- Organizar benefícios, explicação visual “Seu dispositivo → VPN UVV → Portal CAPES”, processo em quatro passos, públicos elegíveis, WireGuard, segurança e perguntas frequentes.
- Encerrar com uma chamada de acesso e rodapé institucional, sem expor informações técnicas ou administrativas internas.

## Links e acesso
- “Solicitar acesso VPN” e “Acessar Service Desk”: `/servicedesk/login`.
- “Primeiro acesso”: `/servicedesk/primeiro-acesso`.
- WireGuard: site oficial de instalação.
- Portal CAPES: endereço informado no briefing.
- A página será pública e não criará autenticação, dados ou fluxos paralelos.

## Detalhes técnicos
- Criar uma página React específica e pequenos elementos locais reutilizáveis.
- Usar os componentes de botão e acordeão já existentes e apenas cores semânticas da plataforma.
- Registrar `/vpn-uvv` nas rotas públicas e no sitemap.
- Definir título, descrição, endereço canônico e metadados sociais específicos pela estrutura de SEO existente.
- Respeitar redução de movimento, navegação por teclado e áreas de toque adequadas.

## Validação
- Verificar compilação e erros de execução.
- Conferir visual e navegação em desktop e celular.
- Validar todos os botões, âncoras e destinos externos.
- Entregar capturas da página em desktop e celular, além do resumo dos links utilizados.
