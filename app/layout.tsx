import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Log Reviewer | Intellinum Flexi Log Analyzer & Diagnostic",
  description: "Web application for checking and diagnosing Intellinum Flexi application screen and server logs, bottom-to-top (newest first).",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
