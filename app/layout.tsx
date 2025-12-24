import type { Metadata } from "next";
import Script from "next/script";

export const metadata: Metadata = {
  title: "7K Rebirth GW Strategist",
  description:
    "A collaborative tool for Seven Knights Rebirth guild members to log, vote, and verify effective team compositions for Guild Wars.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <style>{`body { font-family: 'Inter', sans-serif; }`}</style>
      </head>
      <body className="bg-slate-900 text-slate-100 min-h-screen">
        <Script
          src="https://cdn.tailwindcss.com"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}
