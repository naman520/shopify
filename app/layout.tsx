import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Shopify Order Analytics — State-wise Sales Dashboard",
  description:
    "Analyze product-wise Indian state order volume, units sold, and revenue using Shopify Admin GraphQL API.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased min-h-screen bg-slate-50">{children}</body>
    </html>
  );
}
