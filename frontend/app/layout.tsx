import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "Privacy Lens v2.4 Enterprise",
  description:
    "Enterprise dark-mode privacy policy analyzer — SOC-style cyber threat matrix panel. Uncovers what a privacy policy really means before you click “I Agree”.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}