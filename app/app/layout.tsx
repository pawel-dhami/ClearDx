import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "App",
  description: "Pick symptoms on a body map and see ranked possibilities, with every reason shown. Educational demo, not medical advice.",
};

export default function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
