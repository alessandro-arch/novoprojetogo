import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  GraduationCap,
  Headphones,
  Laptop,
  LockKeyhole,
  Menu,
  MonitorSmartphone,
  Network,
  School,
  ShieldCheck,
  Smartphone,
  Wifi,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import Seo from "@/components/Seo";
import heroImage from "@/assets/vpn-uvv-hero.jpg";

const SERVICE_DESK_LOGIN = "/servicedesk/login";
const FIRST_ACCESS = "/servicedesk/primeiro-acesso";
const WIREGUARD_URL = "https://www.wireguard.com/install/";
const CAPES_URL = "https://www-periodicos-capes-gov-br.ez160.periodicos.capes.gov.br/index.php";

const navItems = [
  { label: "O que é VPN", href: "#o-que-e" },
  { label: "Como funciona", href: "#como-funciona" },
  { label: "FAQ", href: "#faq" },
];

const benefits = [
  {
    icon: BookOpen,
    title: "Acesso remoto",
    description: "Consulte recursos acadêmicos pelo acesso institucional mesmo quando estiver fora da UVV.",
  },
  {
    icon: ShieldCheck,
    title: "Conexão segura",
    description: "Use uma conexão protegida e uma configuração individual disponibilizada pela Universidade.",
  },
  {
    icon: Headphones,
    title: "Processo digital",
    description: "Solicite, acompanhe e receba sua configuração pelo Service Desk Acadêmico.",
  },
];

const steps = [
  {
    number: "01",
    title: "Acesse",
    description: "Entre no Service Desk Acadêmico utilizando sua conta cadastrada.",
  },
  {
    number: "02",
    title: "Solicite",
    description: "Escolha o serviço de acesso VPN, informe a finalidade acadêmica e aceite o termo de uso.",
  },
  {
    number: "03",
    title: "Aguarde a liberação",
    description: "A UVV valida a solicitação e realiza a configuração do acesso.",
  },
  {
    number: "04",
    title: "Conecte-se",
    description: "Importe sua configuração no WireGuard e ative a VPN durante suas pesquisas.",
  },
];

const faqs = [
  {
    question: "O que é a VPN da UVV?",
    answer: "É uma conexão segura que permite utilizar determinados recursos digitais por meio da rede institucional da Universidade Vila Velha, mesmo quando você está fora do campus.",
  },
  {
    question: "Quem pode solicitar?",
    answer: "Alunos regularmente matriculados nos cursos de Mestrado e Doutorado e orientadores com vínculo institucional ativo na Universidade Vila Velha.",
  },
  {
    question: "Para que posso utilizar esse acesso?",
    answer: "O serviço é destinado ao acesso remoto aos recursos acadêmicos autorizados pela UVV, especialmente ao Portal de Periódicos CAPES.",
  },
  {
    question: "Como solicito?",
    answer: "Acesse o Service Desk Acadêmico da UVV, escolha o serviço Acesso VPN ao Portal de Periódicos CAPES, informe a finalidade acadêmica, aceite o termo e envie a solicitação.",
  },
  {
    question: "Como saberei que meu acesso foi liberado?",
    answer: "Você receberá uma notificação e um e-mail com as orientações. O arquivo individual de configuração também ficará disponível na sua área do Service Desk.",
  },
  {
    question: "Preciso instalar algum aplicativo?",
    answer: "Sim. A conexão utiliza o WireGuard, disponível para Windows, macOS, Android, iPhone e iPad.",
  },
  {
    question: "Posso compartilhar meu arquivo de configuração?",
    answer: "Não. O arquivo é uma credencial individual e não deve ser compartilhado, encaminhado ou publicado.",
  },
  {
    question: "Preciso deixar a VPN sempre ligada?",
    answer: "Não. Ative a VPN quando precisar utilizar os recursos acadêmicos que dependem do acesso institucional e desative-a quando terminar a consulta.",
  },
  {
    question: "Por quanto tempo meu acesso ficará ativo?",
    answer: "A validade é definida conforme seu vínculo institucional com a UVV e poderá ser consultada na sua área do Service Desk.",
  },
  {
    question: "Troquei de computador ou celular. O que faço?",
    answer: "Solicite uma nova configuração pelo Service Desk Acadêmico. Não compartilhe ou reutilize configurações destinadas a outras pessoas.",
  },
  {
    question: "Minha VPN não está funcionando. O que faço?",
    answer: "Solicite suporte pelo Service Desk e informe o dispositivo utilizado e, se possível, uma captura da mensagem de erro. Nunca envie o conteúdo do arquivo de configuração nem qualquer chave privada.",
  },
];

const SectionHeading = ({ eyebrow, title, description }: { eyebrow: string; title: string; description?: string }) => (
  <div className="max-w-2xl">
    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">{eyebrow}</p>
    <h2 className="text-3xl font-extrabold leading-tight text-foreground md:text-4xl">{title}</h2>
    {description && <p className="mt-5 text-base leading-7 text-muted-foreground md:text-lg">{description}</p>}
  </div>
);

const VpnUvv = () => {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Seo
        title="Acesso VPN ao Portal CAPES | Universidade Vila Velha"
        description="Solicite o acesso VPN institucional da Universidade Vila Velha para utilizar remotamente o Portal de Periódicos CAPES. Disponível para alunos de Mestrado e Doutorado e orientadores elegíveis."
        path="/vpn-uvv"
      />

      <header className="sticky top-0 z-50 border-b border-border/70 bg-background/95 backdrop-blur-md">
        <div className="container flex h-16 items-center justify-between px-4 md:h-20 md:px-8">
          <a href="#inicio" className="flex items-center gap-3" aria-label="Universidade Vila Velha, início da página">
            <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
              <School className="h-5 w-5" />
            </span>
            <span className="leading-tight">
              <span className="block text-sm font-extrabold">Universidade Vila Velha</span>
              <span className="block text-xs text-muted-foreground">Service Desk Acadêmico</span>
            </span>
          </a>

          <nav className="hidden items-center gap-7 lg:flex" aria-label="Navegação principal">
            {navItems.map((item) => (
              <a key={item.href} href={item.href} className="text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground">
                {item.label}
              </a>
            ))}
            <Button asChild>
              <Link to={SERVICE_DESK_LOGIN}>Acessar Service Desk</Link>
            </Button>
          </nav>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label={menuOpen ? "Fechar menu" : "Abrir menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? <X /> : <Menu />}
          </Button>
        </div>

        {menuOpen && (
          <nav className="border-t border-border bg-background px-4 py-4 lg:hidden" aria-label="Navegação para celular">
            <div className="container flex flex-col gap-1 px-0">
              {navItems.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMenuOpen(false)}
                  className="min-h-11 rounded-md px-3 py-3 text-sm font-semibold text-foreground hover:bg-accent"
                >
                  {item.label}
                </a>
              ))}
              <Button asChild className="mt-2 min-h-11">
                <Link to={SERVICE_DESK_LOGIN}>Acessar Service Desk</Link>
              </Button>
            </div>
          </nav>
        )}
      </header>

      <main>
        <section id="inicio" className="relative min-h-[680px] overflow-hidden border-b border-border md:min-h-[720px]">
          <img
            src={heroImage}
            alt="Pesquisadora utilizando um computador em uma biblioteca universitária"
            width={1600}
            height={1000}
            className="absolute inset-0 h-full w-full object-cover object-[64%_center]"
          />
          <div className="absolute inset-0 bg-background/80 md:bg-background/65" />
          <div className="container relative flex min-h-[680px] items-center px-4 py-20 md:min-h-[720px] md:px-8">
            <div className="max-w-3xl">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/20 bg-background/90 px-4 py-2 text-xs font-bold uppercase tracking-widest text-primary shadow-card">
                <Wifi className="h-4 w-4" />
                VPN Institucional UVV
              </div>
              <h1 className="max-w-3xl text-4xl font-extrabold leading-[1.08] text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
                Acesse o Portal de Periódicos CAPES de onde estiver
              </h1>
              <p className="mt-7 max-w-2xl text-lg leading-8 text-foreground/80 md:text-xl">
                Alunos de Mestrado e Doutorado e orientadores da Universidade Vila Velha podem solicitar acesso remoto por meio da VPN institucional.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" className="min-h-12 px-6 text-sm font-bold uppercase">
                  <Link to={SERVICE_DESK_LOGIN}>
                    Solicitar acesso VPN <ArrowRight />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="min-h-12 bg-background/90 px-6 text-sm font-bold uppercase">
                  <Link to={FIRST_ACCESS}>Primeiro acesso</Link>
                </Button>
              </div>
              <p className="mt-5 flex items-center gap-2 text-sm font-medium text-foreground/70">
                <CheckCircle2 className="h-4 w-4 text-success" />
                Exclusivo para usuários elegíveis da Universidade Vila Velha.
              </p>
            </div>
          </div>
        </section>

        <section aria-label="Benefícios" className="border-b border-border bg-card">
          <div className="container grid px-4 py-6 md:grid-cols-3 md:px-8 md:py-0">
            {benefits.map((benefit, index) => {
              const Icon = benefit.icon;
              return (
                <article key={benefit.title} className={`flex gap-4 py-7 md:px-8 md:py-10 ${index > 0 ? "border-t border-border md:border-l md:border-t-0" : ""}`}>
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-bold text-foreground">{benefit.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">{benefit.description}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        <section id="o-que-e" className="scroll-mt-24 py-20 md:py-28">
          <div className="container grid items-center gap-12 px-4 md:px-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-20">
            <SectionHeading
              eyebrow="Entenda a conexão"
              title="O que é uma VPN?"
              description="A VPN cria uma conexão segura entre seu dispositivo e a rede institucional da Universidade Vila Velha. Durante a conexão, serviços compatíveis podem reconhecer seu acesso pelo IP institucional da UVV."
            />

            <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
              <div className="border-b border-border px-6 py-4">
                <p className="text-sm font-semibold text-muted-foreground">Seu caminho até a pesquisa</p>
              </div>
              <div className="grid gap-3 p-5 sm:grid-cols-[1fr_auto_1fr_auto_1fr] sm:items-center sm:p-8">
                <div className="flex min-h-32 flex-col items-center justify-center rounded-md bg-muted p-5 text-center">
                  <Laptop className="mb-3 h-7 w-7 text-primary" />
                  <span className="text-sm font-bold">Seu dispositivo</span>
                </div>
                <ChevronRight className="mx-auto h-5 w-5 rotate-90 text-muted-foreground sm:rotate-0" />
                <div className="flex min-h-32 flex-col items-center justify-center rounded-md bg-primary p-5 text-center text-primary-foreground">
                  <LockKeyhole className="mb-3 h-7 w-7" />
                  <span className="text-sm font-bold">VPN UVV</span>
                </div>
                <ChevronRight className="mx-auto h-5 w-5 rotate-90 text-muted-foreground sm:rotate-0" />
                <div className="flex min-h-32 flex-col items-center justify-center rounded-md bg-secondary p-5 text-center text-secondary-foreground">
                  <BookOpen className="mb-3 h-7 w-7" />
                  <span className="text-sm font-bold">Portal CAPES</span>
                </div>
              </div>
              <p className="border-t border-border px-6 py-5 text-sm leading-6 text-muted-foreground">
                Assim, você acessa remotamente recursos acadêmicos autorizados pela Universidade.
              </p>
            </div>
          </div>
        </section>

        <section id="como-funciona" className="scroll-mt-24 bg-foreground py-20 text-background md:py-28">
          <div className="container px-4 md:px-8">
            <div className="flex flex-col justify-between gap-8 md:flex-row md:items-end">
              <div className="max-w-2xl">
                <p className="mb-3 text-xs font-bold uppercase tracking-widest text-secondary">Como funciona</p>
                <h2 className="text-3xl font-extrabold leading-tight md:text-4xl">Solicite seu acesso em poucos passos</h2>
              </div>
              <p className="max-w-md text-sm leading-6 text-background/70">Todo o processo acontece no Service Desk Acadêmico, do pedido ao recebimento da configuração.</p>
            </div>

            <div className="mt-12 grid border-y border-background/20 md:grid-cols-2 lg:grid-cols-4">
              {steps.map((step, index) => (
                <article key={step.number} className={`min-h-60 py-8 md:p-8 ${index > 0 ? "border-t border-background/20 md:border-l md:border-t-0" : ""} ${index === 2 ? "md:border-l-0 lg:border-l" : ""}`}>
                  <span className="text-sm font-bold text-secondary">{step.number}</span>
                  <h3 className="mt-10 text-xl font-bold">{step.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-background/70">{step.description}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="py-20 md:py-28">
          <div className="container px-4 md:px-8">
            <SectionHeading eyebrow="Elegibilidade" title="Quem pode solicitar?" />
            <div className="mt-10 grid gap-5 md:grid-cols-2">
              <article className="group rounded-lg border border-border bg-card p-7 shadow-card transition-colors hover:border-primary/40 md:p-9">
                <GraduationCap className="h-9 w-9 text-primary" />
                <h3 className="mt-8 text-2xl font-bold">Alunos</h3>
                <p className="mt-3 max-w-md leading-7 text-muted-foreground">Alunos regularmente matriculados nos cursos de Mestrado ou Doutorado da Universidade Vila Velha.</p>
              </article>
              <article className="group rounded-lg border border-border bg-card p-7 shadow-card transition-colors hover:border-primary/40 md:p-9">
                <CircleUserRound className="h-9 w-9 text-primary" />
                <h3 className="mt-8 text-2xl font-bold">Orientadores</h3>
                <p className="mt-3 max-w-md leading-7 text-muted-foreground">Orientadores com vínculo institucional ativo na Universidade Vila Velha.</p>
              </article>
            </div>
          </div>
        </section>

        <section className="border-y border-border bg-card py-20 md:py-28">
          <div className="container grid gap-12 px-4 md:px-8 lg:grid-cols-2 lg:gap-20">
            <div>
              <SectionHeading
                eyebrow="WireGuard"
                title="Conecte no computador ou no celular"
                description="Após a liberação, você receberá seu arquivo individual de configuração e as instruções para utilização da VPN."
              />
              <Button asChild size="lg" className="mt-8 min-h-12">
                <a href="#instrucoes-instalacao">
                  <BookOpen /> Instruções de Instalação
                </a>
              </Button>
              <p className="mt-4 text-sm text-muted-foreground">O aplicativo oficial está disponível em <a className="font-semibold text-primary underline-offset-4 hover:underline" href={WIREGUARD_URL} target="_blank" rel="noreferrer">wireguard.com/install</a>.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border border-border bg-background p-7">
                <MonitorSmartphone className="h-8 w-8 text-primary" />
                <p className="mt-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">Computador</p>
                <h3 className="mt-2 text-xl font-bold">Windows e macOS</h3>
              </div>
              <div className="rounded-lg border border-border bg-background p-7">
                <Smartphone className="h-8 w-8 text-primary" />
                <p className="mt-8 text-xs font-bold uppercase tracking-widest text-muted-foreground">Celular ou tablet</p>
                <h3 className="mt-2 text-xl font-bold">Android, iPhone e iPad</h3>
              </div>
            </div>
          </div>
        </section>

        <section id="instrucoes-instalacao" className="scroll-mt-24 py-20 md:py-28">
          <div className="container px-4 md:px-8">
            <SectionHeading
              eyebrow="Passo a passo"
              title="Instruções de Instalação"
              description="Guia completo para instalar, importar sua configuração e utilizar a VPN com segurança."
            />

            <div className="mt-10 grid gap-5 lg:grid-cols-2">
              <article className="rounded-lg border border-border bg-card p-7 shadow-card md:p-9">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Laptop className="h-5 w-5" />
                  </span>
                  <h3 className="text-xl font-bold">Computador Windows ou macOS</h3>
                </div>
                <ol className="mt-6 space-y-3 text-sm leading-6 text-muted-foreground">
                  <li>Instale o aplicativo oficial WireGuard em <a className="font-semibold text-primary underline-offset-4 hover:underline" href={WIREGUARD_URL} target="_blank" rel="noreferrer">wireguard.com/install</a>.</li>
                  <li>Abra o WireGuard.</li>
                  <li>Selecione a opção "Adicionar túnel" ou "Add Tunnel".</li>
                  <li>Escolha "Importar túnel de arquivo" ou "Import tunnel from file".</li>
                  <li>Selecione o arquivo .conf anexado ao e-mail de liberação.</li>
                  <li>Após a importação, selecione o túnel "VPNCAPES" e clique em "Ativar".</li>
                </ol>
              </article>

              <article className="rounded-lg border border-border bg-card p-7 shadow-card md:p-9">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                    <Smartphone className="h-5 w-5" />
                  </span>
                  <h3 className="text-xl font-bold">Celular Android ou iPhone</h3>
                </div>
                <ol className="mt-6 space-y-3 text-sm leading-6 text-muted-foreground">
                  <li>Instale o aplicativo oficial WireGuard pela Play Store ou App Store.</li>
                  <li>Salve o arquivo .conf anexado ao e-mail no dispositivo.</li>
                  <li>Abra o WireGuard e toque no botão +.</li>
                  <li>Selecione "Importar de arquivo ou arquivo compactado".</li>
                  <li>Localize e selecione o arquivo .conf.</li>
                  <li>Ative o túnel "VPNCAPES".</li>
                </ol>
              </article>
            </div>

            <article className="mt-5 rounded-lg border border-border bg-card p-7 shadow-card md:p-9">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Wifi className="h-5 w-5" />
                </span>
                <h3 className="text-xl font-bold">Como utilizar</h3>
              </div>
              <ol className="mt-6 max-w-3xl space-y-3 text-sm leading-6 text-muted-foreground">
                <li>Conecte o dispositivo à sua internet residencial ou rede móvel.</li>
                <li>Abra o WireGuard e ative a VPNCAPES.</li>
                <li>Acesse o <a className="font-semibold text-primary underline-offset-4 hover:underline" href={CAPES_URL} target="_blank" rel="noreferrer">Portal de Periódicos CAPES</a> normalmente.</li>
                <li>Ao concluir a consulta, volte ao WireGuard e desative a VPN.</li>
              </ol>
              <p className="mt-5 max-w-3xl text-sm leading-6 text-muted-foreground">
                Enquanto a VPN estiver ativa, a navegação do dispositivo utilizará a conexão e o IP institucional. Por isso, mantenha-a ativada somente durante o uso acadêmico.
              </p>
            </article>

            <article className="mt-5 rounded-lg border border-primary/30 bg-primary/5 p-7 md:p-9">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-md bg-primary text-primary-foreground">
                  <LockKeyhole className="h-5 w-5" />
                </span>
                <h3 className="text-xl font-bold">Segurança da sua credencial</h3>
              </div>
              <p className="mt-5 text-sm font-semibold text-foreground">O arquivo anexado é uma credencial pessoal. Por segurança:</p>
              <ul className="mt-3 max-w-3xl space-y-2 text-sm leading-6 text-muted-foreground">
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Não encaminhe nem compartilhe o arquivo com outras pessoas.</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Não publique o arquivo em grupos ou pastas compartilhadas.</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Utilize-o em apenas um dispositivo.</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Após a importação, exclua o arquivo da pasta de downloads e do e-mail, se possível.</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" /> Em caso de perda, troca ou formatação do dispositivo, solicite uma nova configuração à equipe de TI.</li>
              </ul>
              <p className="mt-6 max-w-3xl text-sm leading-6 text-muted-foreground">
                Caso a VPN não conecte ou o Portal CAPES não reconheça o acesso institucional, entre em contato com a equipe de TI informando o dispositivo utilizado e, se possível, enviando uma captura do erro. Não envie o conteúdo do arquivo .conf nem qualquer chave privada.
              </p>
            </article>
          </div>
        </section>

        <section className="py-20 md:py-24">
          <div className="container px-4 md:px-8">
            <div className="relative overflow-hidden rounded-lg bg-primary p-7 text-primary-foreground md:p-12">
              <Network className="absolute right-8 top-8 h-24 w-24 opacity-10 md:h-36 md:w-36" aria-hidden="true" />
              <div className="relative max-w-3xl">
                <div className="flex h-12 w-12 items-center justify-center rounded-md bg-primary-foreground/15">
                  <LockKeyhole className="h-6 w-6" />
                </div>
                <h2 className="mt-8 text-3xl font-extrabold">Sua configuração é individual</h2>
                <p className="mt-4 max-w-2xl text-base leading-7 text-primary-foreground/80 md:text-lg">
                  O arquivo de configuração da VPN funciona como uma credencial pessoal. Não encaminhe, publique ou compartilhe esse arquivo com outras pessoas.
                </p>
                <p className="mt-5 text-sm font-semibold">Ative a VPN apenas durante o uso dos recursos acadêmicos e desative-a ao concluir.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="faq" className="scroll-mt-24 border-t border-border bg-card py-20 md:py-28">
          <div className="container grid gap-12 px-4 md:px-8 lg:grid-cols-[0.7fr_1.3fr] lg:gap-20">
            <div>
              <SectionHeading eyebrow="Perguntas frequentes" title="Ainda tem dúvidas?" description="Encontre respostas rápidas sobre solicitação, uso e segurança da VPN institucional." />
            </div>
            <Accordion type="single" collapsible className="border-t border-border">
              {faqs.map((faq, index) => (
                <AccordionItem key={faq.question} value={`faq-${index}`}>
                  <AccordionTrigger className="py-5 text-left text-base font-bold hover:no-underline">{faq.question}</AccordionTrigger>
                  <AccordionContent className="max-w-2xl pb-5 text-base leading-7 text-muted-foreground">{faq.answer}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        <section className="bg-secondary py-16 md:py-20">
          <div className="container flex flex-col justify-between gap-8 px-4 md:px-8 lg:flex-row lg:items-center">
            <div className="max-w-2xl">
              <p className="text-xs font-bold uppercase tracking-widest text-secondary-foreground/70">Comece agora</p>
              <h2 className="mt-3 text-3xl font-extrabold leading-tight text-secondary-foreground md:text-4xl">Pronto para acessar o Portal de Periódicos CAPES?</h2>
              <p className="mt-4 text-secondary-foreground/80">Solicite seu acesso remoto pelo Service Desk Acadêmico da Universidade Vila Velha.</p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <Button asChild size="lg" className="min-h-12">
                <Link to={SERVICE_DESK_LOGIN}>Solicitar acesso VPN <ArrowRight /></Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="min-h-12 border-secondary-foreground/30 bg-transparent text-secondary-foreground hover:bg-secondary-foreground/10 hover:text-secondary-foreground">
                <Link to={FIRST_ACCESS}>Primeiro acesso</Link>
              </Button>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-foreground py-12 text-background">
        <div className="container flex flex-col gap-9 px-4 md:px-8 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-md bg-background/10">
                <School className="h-5 w-5" />
              </span>
              <div>
                <p className="font-extrabold">Universidade Vila Velha</p>
                <p className="text-sm text-background/60">Service Desk Acadêmico</p>
              </div>
            </div>
            <p className="mt-6 text-xs text-background/50">Acesso acadêmico simples, seguro e institucional.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-sm font-semibold" aria-label="Links institucionais">
            <a href={CAPES_URL} target="_blank" rel="noreferrer" className="text-background/70 hover:text-background">Portal de Periódicos CAPES</a>
            <a href={WIREGUARD_URL} target="_blank" rel="noreferrer" className="text-background/70 hover:text-background">WireGuard</a>
            <Link to={SERVICE_DESK_LOGIN} className="text-background/70 hover:text-background">Service Desk</Link>
          </nav>
        </div>
      </footer>
    </div>
  );
};

export default VpnUvv;
