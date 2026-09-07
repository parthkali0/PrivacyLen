import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Privacy Lens",
  description:
    "AI-powered privacy policy analyzer that turns legalese, Terms of Service, and privacy contracts into plain English.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}