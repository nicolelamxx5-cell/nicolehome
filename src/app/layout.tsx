import type { Metadata, Viewport } from "next";
import { Inter, Cormorant_Garamond } from "next/font/google";
import "./globals.css";
import { ServiceWorker } from "@/components/service-worker";

// next/font downloads these at build time and serves them from our own domain,
// so nothing is requested from Google at runtime (Google is blocked in mainland China).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-cormorant",
  display: "swap",
});

export const metadata: Metadata = {
  title: { default: "661C Home Hub", template: "%s · 661C Home Hub" },
  description: "Private renovation shopping and budget planner for 661C Edgedale Plains.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "661C Home", statusBarStyle: "default" },
  robots: { index: false, follow: false },
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#faf7f2",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-SG" className={`${inter.variable} ${cormorant.variable} antialiased`}>
      <body className="min-h-dvh">
        {children}
        <ServiceWorker />
      </body>
    </html>
  );
}
