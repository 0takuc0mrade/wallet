import type { Metadata } from "next";

import "./globals.css";
import ContextProvider from "@/context";

export const metadata: Metadata = {
  title: "Axiom Bot",
  description: "AppKit example dApp",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <ContextProvider>{children}</ContextProvider>
      </body>
    </html>
  );
}
