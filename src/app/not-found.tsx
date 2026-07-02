import { LinkButton } from "@/components/ui/link-button";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";

export default function NotFound() {
  const dict = getDictionary(getLocale());

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-4 bg-background p-4 text-center">
      <p className="text-4xl">🔍</p>
      <h1 className="text-lg font-semibold text-gray-900">{dict.notFound.title}</h1>
      <p className="text-sm text-text-secondary">{dict.notFound.description}</p>
      <LinkButton href="/">{dict.notFound.backHome}</LinkButton>
    </main>
  );
}
