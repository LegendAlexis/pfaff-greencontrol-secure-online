import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Pfaff GreenControl",
  description: "Professionelle Gewächshaussteuerung",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="de" className="h-full">
      <body className="min-h-full bg-zinc-950 antialiased">{children}</body>
    </html>
  );
}
