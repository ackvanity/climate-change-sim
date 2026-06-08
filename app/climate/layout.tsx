import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "The Greenhouse Effect",
  description: "A demonstration on how greenhouse gases change global temperatures",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    children
  );
}
