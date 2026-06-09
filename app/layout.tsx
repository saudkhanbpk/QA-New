import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "QA Testing System",
  description: "Automated QA testing for any webpage",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
