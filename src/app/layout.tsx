import type { Metadata, Viewport } from "next";
import { Sarabun, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { getLocale } from "@/i18n/get-locale";
import { getDictionary } from "@/i18n/get-dictionary";

const sarabun = Sarabun({
  subsets: ["thai", "latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-sarabun",
  display: "swap",
});

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-thai",
  display: "swap",
});

export function generateMetadata(): Metadata {
  const dict = getDictionary(getLocale());
  return {
    title: dict.brand.name,
    description: dict.home.subtitle,
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = getLocale();
  const dict = getDictionary(locale);

  return (
    <html lang={locale}>
      <body
        className={`${sarabun.variable} ${notoSansThai.variable} font-sans antialiased bg-background text-foreground`}
      >
        <Providers locale={locale} dict={dict}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
