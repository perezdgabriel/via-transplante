import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { TenantProvider } from "./TenantContext";
import { requireTenant } from "@/lib/tenant-server";
import { publicTenant } from "@/lib/tenants";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Via Trasplante",
  description:
    "Asistente virtual para pacientes pediátricos trasplantados y sus cuidadores.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const tenant = await requireTenant();
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <TenantProvider tenant={publicTenant(tenant)}>{children}</TenantProvider>
      </body>
    </html>
  );
}
