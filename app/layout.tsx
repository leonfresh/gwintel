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
        <style>{`
          body { font-family: 'Inter', sans-serif; }

          /* Prevent initial flash of huge SVGs before Tailwind utilities load */
          svg { width: 1.25rem; height: 1.25rem; display: inline-block; }

          /* Slow, modern background motion */
          @keyframes drift-a {
            0% { transform: translate3d(-6%, -4%, 0) scale(1); }
            50% { transform: translate3d(6%, 4%, 0) scale(1.06); }
            100% { transform: translate3d(-6%, -4%, 0) scale(1); }
          }
          @keyframes drift-b {
            0% { transform: translate3d(4%, 6%, 0) scale(1); }
            50% { transform: translate3d(-4%, -6%, 0) scale(1.08); }
            100% { transform: translate3d(4%, 6%, 0) scale(1); }
          }
          @keyframes drift-c {
            0% { transform: translate3d(0%, 0%, 0) scale(1); }
            50% { transform: translate3d(0%, 3%, 0) scale(1.04); }
            100% { transform: translate3d(0%, 0%, 0) scale(1); }
          }
          .bg-orb {
            filter: blur(70px);
            transform: translate3d(0, 0, 0);
            will-change: transform;
          }
          .animate-drift-a { animation: drift-a 28s ease-in-out infinite; }
          .animate-drift-b { animation: drift-b 34s ease-in-out infinite; }
          .animate-drift-c { animation: drift-c 40s ease-in-out infinite; }

          /* Glassmorphism utility (colors stay in Tailwind classes) */
          .glass {
            -webkit-backdrop-filter: blur(24px) saturate(1.4);
            backdrop-filter: blur(24px) saturate(1.4);
            box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
          }

          /* Slate / Film Grain Texture */
          .bg-grain {
            background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='1.5' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)' opacity='0.05'/%3E%3C/svg%3E");
            background-repeat: repeat;
          }

          @media (prefers-reduced-motion: reduce) {
            .animate-drift-a, .animate-drift-b, .animate-drift-c { animation: none !important; }
          }
        `}</style>
      </head>
      <body className="bg-slate-950 text-slate-100 min-h-screen relative overflow-x-hidden">
        <Script
          src="https://cdn.tailwindcss.com"
          strategy="beforeInteractive"
        />

        {/* Animated background layers (purely decorative) */}
        <div className="pointer-events-none fixed inset-0 -z-10">
          <div className="absolute inset-0 bg-slate-950" />
          <div className="absolute -top-56 -left-56 w-[44rem] h-[44rem] rounded-full bg-orb animate-drift-a bg-gradient-to-br from-blue-500/25 via-fuchsia-500/15 to-transparent" />
          <div className="absolute -bottom-64 -right-64 w-[48rem] h-[48rem] rounded-full bg-orb animate-drift-b bg-gradient-to-tr from-emerald-500/20 via-cyan-500/12 to-transparent" />
          <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-[40rem] h-[40rem] rounded-full bg-orb animate-drift-c bg-gradient-to-r from-purple-500/12 via-blue-500/10 to-emerald-500/12" />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-slate-950/40 to-slate-950/80" />
          <div className="absolute inset-0 bg-grain opacity-20 mix-blend-overlay" />
        </div>

        {children}
      </body>
    </html>
  );
}
