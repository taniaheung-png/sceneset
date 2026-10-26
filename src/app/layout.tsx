import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// One family, as in the reference site: Inter, used for headings, body and figures.
const ui = Inter({ variable: "--font-ui", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: { default: "SceneSet — one plan for your whole event", template: "%s · SceneSet" },
  description:
    "SceneSet keeps tasks, suppliers, budget, guests, running order and venue layout in one shared plan for small event teams. Prototype with fictional demo data.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={ui.variable}>
      <body className="min-h-screen bg-paper text-ink">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-surface"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
