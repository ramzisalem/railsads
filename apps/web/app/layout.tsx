import type { Metadata } from "next";
import { inter, playfair } from "./fonts";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "RailsAds — AI ads for ecommerce brands",
    template: "%s | RailsAds",
  },
  description:
    "Create high-converting ad creatives in minutes. AI-powered brand and ad platform for ecommerce — from import to studio-ready ads.",
  openGraph: {
    title: "RailsAds — AI ads for ecommerce brands",
    description:
      "Create high-converting ad creatives in minutes. AI-powered brand and ad platform for ecommerce brands.",
    url: appUrl,
    siteName: "RailsAds",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RailsAds — AI ads for ecommerce brands",
    description:
      "Create high-converting ad creatives in minutes. AI-powered brand and ad platform for ecommerce brands.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${playfair.variable} h-full`}
      suppressHydrationWarning
    >
      <body className="min-h-full" suppressHydrationWarning>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
