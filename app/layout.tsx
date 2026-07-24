import type { Metadata, Viewport } from "next";
import "./globals.css";
import CommandPalette from "@/components/CommandPalette";
import ServiceWorker from "@/components/ServiceWorker";

export const metadata: Metadata = {
  title: "The Lab",
  description: "A home for half-formed ideas & whatever I build on a whim.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "The Lab",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icon-192.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0C0A0E",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        {children}
        <CommandPalette />
        <ServiceWorker />
      </body>
    </html>
  );
}
