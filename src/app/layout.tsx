import type { Metadata, Viewport } from "next";
import { Sarabun, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

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

export const metadata: Metadata = {
  title: "ระบบบริหารร้านนวด",
  description: "ระบบจองคิวและบริหารร้านนวดครบวงจร",
};

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
  return (
    <html lang="th">
      <body
        className={`${sarabun.variable} ${notoSansThai.variable} font-sans antialiased bg-neutral-50 text-neutral-900`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
