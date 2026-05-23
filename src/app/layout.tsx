import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "@xyflow/react/dist/style.css";
import { AppShell } from "@/components/app-shell";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { getSessionUser } from "@/lib/auth/session";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OmniGrid — Homelab Command Center",
  description:
    "Single pane of glass for managing your homelab infrastructure. SSH, topology, proxy, and more.",
  icons: {
    icon: "/logo.png",
    apple: "/logo.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Get current user (null if not logged in)
  let user: {
    username: string;
    displayName: string | null;
    avatarUrl: string | null;
  } | null = null;
  try {
    const sessionUser = await getSessionUser();
    if (sessionUser) {
      user = {
        username: sessionUser.username,
        displayName: sessionUser.displayName,
        avatarUrl: sessionUser.avatarUrl,
      };
    }
  } catch {
    // Session lookup may fail during build or when DB is not ready
  }

  return (
    <html
      lang="en"
      className={`dark ${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col overflow-hidden">
        <TooltipProvider delay={150}>
          <AppShell user={user}>{children}</AppShell>
          <Toaster richColors position="top-right" />
        </TooltipProvider>
      </body>
    </html>
  );
}
