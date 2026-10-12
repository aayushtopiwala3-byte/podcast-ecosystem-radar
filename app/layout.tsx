import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Sidebar from "@/components/Sidebar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Podcast Ecosystem Radar",
  description: "Weekly intelligence on guests, topics and sponsors across Aditya's podcast ecosystem.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex bg-[#0a0e1a] text-[#e8eaf5]">
        <Sidebar />
        <main className="flex-1 min-w-0 px-6 py-8 md:px-10 md:py-10">{children}</main>
      </body>
    </html>
  );
}
