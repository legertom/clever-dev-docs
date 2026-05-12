import type { Metadata } from "next";
import { Merriweather, Inter } from "next/font/google";
import Nav from "@/components/Nav";
import "./globals.css";

const merriweather = Merriweather({
  variable: "--font-heading",
  subsets: ["latin"],
  weight: ["400", "700"],
});

const inter = Inter({
  variable: "--font-body",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Clever Dev Docs Assistant",
  description:
    "AI-powered assistant for Clever developer documentation. Get instant answers about Clever Library, Secure Sync, SSO, and APIs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${merriweather.variable} ${inter.variable} h-full antialiased`}
    >
      <body className="h-full flex flex-col">
        <Nav />
        {children}
      </body>
    </html>
  );
}
