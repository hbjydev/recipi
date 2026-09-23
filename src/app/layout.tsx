import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Recipi — Your recipe collection",
  description: "A calm place to keep the recipes you love.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
