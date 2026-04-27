import type { Metadata } from "next";
import { inter, playfair } from "./fonts";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(appUrl),
  title: {
    default: "RailsAds — AI Ads Creative Strategist",
    template: "%s | RailsAds",
  },
  description:
    "Your AI ads creative strategist. RailsAds turns brand context, products and audiences into high-converting ad creatives in minutes.",
  openGraph: {
    title: "RailsAds — AI Ads Creative Strategist",
    description:
      "Your AI ads creative strategist. RailsAds turns brand context, products and audiences into high-converting ad creatives in minutes.",
    url: appUrl,
    siteName: "RailsAds",
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "RailsAds — AI Ads Creative Strategist",
    description:
      "Your AI ads creative strategist. RailsAds turns brand context, products and audiences into high-converting ad creatives in minutes.",
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
