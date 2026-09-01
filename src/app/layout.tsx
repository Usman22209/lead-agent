import type { Metadata } from "next";
import { Sidebar } from "@/components/Sidebar";
import "./globals.css";

export const metadata: Metadata = {
  title: "LeadAgent AI — Outbound AI Sales Pipeline",
  description: "Automated Google Maps Lead Discovery, Qualification & AI Scoring Engine",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen flex selection:bg-indigo-500 selection:text-white">
        <Sidebar />
        <main className="flex-1 flex flex-col min-w-0 h-screen overflow-y-auto">
          {children}
        </main>
      </body>
    </html>
  );
}
