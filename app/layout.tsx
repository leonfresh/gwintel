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
      <body className="relative text-slate-100 min-h-screen overflow-x-hidden">
        <Script
          src="https://cdn.tailwindcss.com"
          strategy="beforeInteractive"
        />
        <style>{`
          @keyframes gradientShift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          @keyframes float {
            0%, 100% { transform: translateY(0px) translateX(0px); }
            33% { transform: translateY(-30px) translateX(20px); }
            66% { transform: translateY(15px) translateX(-20px); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 0.3; }
            50% { opacity: 0.6; }
          }
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .animated-gradient {
            background: linear-gradient(-45deg, #0f172a, #1e1b4b, #312e81, #1e3a8a, #0f172a);
            background-size: 400% 400%;
            animation: gradientShift 20s ease infinite;
          }
          .floating-orb {
            position: fixed;
            border-radius: 50%;
            filter: blur(80px);
            pointer-events: none;
            animation: float 20s ease-in-out infinite, pulse 8s ease-in-out infinite;
          }
          .glass {
            background: rgba(15, 23, 42, 0.6);
            backdrop-filter: blur(20px);
            -webkit-backdrop-filter: blur(20px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            position: relative;
          }
          .glass::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.03), transparent);
            animation: shimmer 3s infinite;
          }
          .glass-light {
            background: rgba(30, 41, 59, 0.4);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(255, 255, 255, 0.08);
            position: relative;
          }
          .glass-light::before {
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.02), transparent);
            animation: shimmer 3s infinite;
          }
        `}</style>
        <div className="animated-gradient fixed inset-0 -z-10"></div>
        <div
          className="floating-orb"
          style={{
            width: "600px",
            height: "600px",
            background:
              "radial-gradient(circle, rgba(59, 130, 246, 0.5) 0%, transparent 70%)",
            top: "-10%",
            left: "-10%",
            animationDelay: "0s",
            zIndex: -5,
          }}
        ></div>
        <div
          className="floating-orb"
          style={{
            width: "500px",
            height: "500px",
            background:
              "radial-gradient(circle, rgba(168, 85, 247, 0.4) 0%, transparent 70%)",
            top: "40%",
            right: "-10%",
            animationDelay: "5s",
            zIndex: -5,
          }}
        ></div>
        <div
          className="floating-orb"
          style={{
            width: "400px",
            height: "400px",
            background:
              "radial-gradient(circle, rgba(14, 165, 233, 0.3) 0%, transparent 70%)",
            bottom: "-10%",
            left: "30%",
            animationDelay: "10s",
            zIndex: -5,
          }}
        ></div>
        {children}
      </body>
    </html>
  );
}
