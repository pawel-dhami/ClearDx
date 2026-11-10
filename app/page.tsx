import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";
import { Nav } from "@/components/site/Nav";

// Section 1 placeholder; the full landing page replaces this in section 4.
export default function Landing() {
  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <Nav
        right={
          <Link href="/app" className="btn btn-primary">
            Launch app
          </Link>
        }
      />
      <main className="mx-auto flex w-full max-w-[1440px] flex-1 flex-col justify-center px-4 py-16 sm:px-8">
        <p className="label mb-6">Explainable AI · Educational demo</p>
        <h1 className="font-display text-6xl font-bold leading-[0.92] tracking-[0.05em] uppercase sm:text-8xl">
          See <span className="text-cyan glow">why</span>,<br />
          not just what.
        </h1>
        <p className="mt-8 max-w-[34ch] text-xl text-soft">
          Pick symptoms on a body map. Get ranked possibilities — with every reason shown.
        </p>
        <div className="mt-10">
          <Link href="/app" className="btn btn-primary h-14 px-7 text-sm">
            Launch app <span aria-hidden>→</span>
          </Link>
        </div>
      </main>
      <Disclaimer className="mx-4 mb-4 sm:mx-8" />
    </div>
  );
}
