import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DSA Trainer",
  description: "Pair-program DSA problems with an AI collaborator",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full bg-neutral-950 text-neutral-100 antialiased overflow-hidden">
        {children}
      </body>
    </html>
  );
}
