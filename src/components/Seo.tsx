import { Helmet } from "react-helmet-async";

const SITE_URL = "https://projetogo.innovago.app";

interface SeoProps {
  title: string;
  description: string;
  path: string;
  noindex?: boolean;
}

const Seo = ({ title, description, path, noindex }: SeoProps) => {
  const url = `${SITE_URL}${path}`;
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content="website" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      {noindex && <meta name="robots" content="noindex, follow" />}
    </Helmet>
  );
};

export default Seo;
