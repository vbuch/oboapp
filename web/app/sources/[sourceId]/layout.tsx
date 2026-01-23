import { Metadata } from "next";
import { SourceConfig } from "@/lib/types";
import sourcesData from "@/lib/sources.json";

interface Props {
  children: React.ReactNode;
}

export async function generateMetadata({
  params,
}: {
  params: { sourceId: string };
}): Promise<Metadata> {
  const source = (sourcesData as SourceConfig[]).find(
    (s) => s.id === params.sourceId,
  );

  if (!source) {
    return {
      title: "Източник не е намерен - OboApp",
    };
  }

  const baseUrl = "https://oboapp.online";
  const logoUrl = `${baseUrl}/sources/${source.id}.png`;

  return {
    title: `${source.name} - OboApp`,
    description: `Последни съобщения от ${source.name} за събития и ремонти в София`,
    openGraph: {
      title: `${source.name} - OboApp`,
      description: `Последни съобщения от ${source.name} за събития и ремонти в София`,
      url: `${baseUrl}/sources/${source.id}`,
      siteName: "OboApp",
      images: [
        {
          url: logoUrl,
          width: 128,
          height: 128,
          alt: source.name,
        },
      ],
      locale: "bg_BG",
      type: "website",
    },
    twitter: {
      card: "summary",
      title: `${source.name} - OboApp`,
      description: `Последни съобщения от ${source.name} за събития и ремонти в София`,
      images: [logoUrl],
    },
  };
}

export default function SourceLayout({ children }: Props) {
  return <>{children}</>;
}
