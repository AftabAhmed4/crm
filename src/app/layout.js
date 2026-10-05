import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import BreakTimerModal from "@/components/BreakTimerModal";
import { Toaster } from "react-hot-toast";
import LogoutModal from "@/components/LogoutModal";
import DailyLogout from "@/components/DailyLogout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Digital Orbit CRM",
  description: "Digital Orbit CRM — Manage calls, staff activity, attendance, breaks, and customer operations in one place.",
};


export default function RootLayout({ children }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <DailyLogout />
        <BreakTimerModal />
        {children} 
        <Toaster position="top-right" />
      </body>
    </html>
  );
}
