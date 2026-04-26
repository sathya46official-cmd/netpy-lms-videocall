import { ReactNode } from "react";
import type { Metadata } from "next";
import { Outfit } from "next/font/google";

import "react-datepicker/dist/react-datepicker.css";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const outfit = Outfit({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700"] });

export const metadata: Metadata = {
  title: {
    template: "%s | YOOM LMS Video Call",
    default: "YOOM | Premium LMS Video Call Platform",
  },
  description: "A high-performance, multi-tenant LMS platform for video lectures, real-time collaboration, and secure recording management.",
  openGraph: {
    title: "YOOM | Premium LMS Video Call Platform",
    description: "Enterprise-grade video calls, real-time collaboration, and MinIO storage.",
    type: "website",
    locale: "en_US",
    siteName: "YOOM",
  },
  icons: {
    icon: "/icons/logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="en">
        <body className={`${outfit.className} bg-dark-2`}>
          <Toaster />
          {children}
        </body>
    </html>
  );
}
