import type { Metadata, Viewport } from "next";

import "./globals.css";

export const metadata: Metadata = {
  title: "Document Ingestion",
  description: "Upload and review healthcare 837 EDI claim files and EOB / 835 images.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0f766e",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="scheme-light">
      <body className="min-h-screen bg-slate-100 font-sans text-slate-900 antialiased">{children}</body>
    </html>
  );
}
