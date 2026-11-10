import Link from "next/link";
import { Disclaimer } from "@/components/Disclaimer";
import { HeroBody } from "@/components/landing/HeroBody";
import { ShowcaseGraph, StepPickScene, StepPredictScene, StepWhyScene, WhatIfDemo } from "@/components/landing/Demos";
import { Reveal } from "@/components/landing/Reveal";
import { Corners, LogoMark } from "@/components/site/Hud";
import { Nav } from "@/components/site/Nav";

const GITHUB = "https://github.com/pawel-dhami/ClearDx";

function SectionHead({ n, kicker, title, id, tone = "cyan" }: { n: string; kicker: string; title: string; id: string; tone?: "cyan" | "amber" }) {
  return (
    <>
      <p className="label mb-3">
        <span className={tone === "amber" ? "text-amber" : "text-cyan"}>{n}</span> / {kicker}
      </p>
      <h2 id={id} className="font-display text-4xl leading-none font-bold tracking-[0.05em] uppercase sm:text-[40px]">
        {title}
      </h2>
    </>
  );
}

export default function Landing() {
  return (
    <div className="relative z-10">
      <Nav
        right={
          <Link href="/app" className="btn btn-primary">
            Launch app
          </Link>
        }
      />

      <main>
        {/* ---------- 1. Hero ---------- */}
        <section aria-labelledby="hero-title" className="mx-auto grid w-full max-w-[1440px] items-center gap-8 px-4 sm:px-8 lg:min-h-[calc(100vh-96px)] lg:grid-cols-12">
          <div className="py-12 lg:col-span-5 lg:py-16">
            <p className="label mb-6 flex items-center gap-3">
              <span aria-hidden className="inline-block h-px w-8 bg-cyan" />
              Explainable AI · Educational demo
            </p>
            <h1 id="hero-title" className="font-display text-6xl leading-[0.92] font-bold tracking-[0.05em] uppercase sm:text-7xl xl:text-[96px]">
              See <span className="text-cyan glow">why</span>,
              <br />
              not just what.
            </h1>
            <p className="mt-8 max-w-[34ch] text-xl leading-relaxed text-soft">
              Pick symptoms on a body map. Get ranked possibilities — with every reason shown.
            </p>
            <div className="mt-10 flex flex-wrap items-center gap-4">
              <Link href="/app" className="btn btn-primary h-14 px-7 text-sm">
                Launch app <span aria-hidden>→</span>
              </Link>
              <a href="#how-it-works" className="btn btn-ghost h-14 px-7 text-sm">
                How it works
              </a>
            </div>
            <p className="mt-10 inline-flex items-center gap-3 border-l-2 border-amber pl-3 text-sm text-soft">
              <span className="font-mono text-xs text-amber">EDUCATIONAL DEMO</span> Not medical advice.
            </p>
          </div>
          <div className="relative h-[520px] sm:h-[640px] lg:col-span-7 lg:h-[760px]">
            <div aria-hidden className="ruler-y absolute inset-y-10 left-0" />
            <div aria-hidden className="ruler-x absolute inset-x-10 bottom-0" />
            <HeroBody />
            <p className="label absolute bottom-6 left-6">↖ Move your cursor — the body follows</p>
          </div>
        </section>

        {/* ---------- 2. How it works ---------- */}
        <section id="how-it-works" aria-labelledby="how-title" className="mx-auto w-full max-w-[1440px] scroll-mt-6 px-4 py-24 sm:px-8 lg:py-28">
          <Reveal className="mb-12 flex items-end justify-between gap-6">
            <div>
              <SectionHead n="01" kicker="How it works" title="Three steps. No black box." id="how-title" />
            </div>
            <div aria-hidden className="ruler-x hidden w-1/3 sm:block" />
          </Reveal>
          <ol className="grid gap-6 md:grid-cols-3">
            {[
              { n: "01", t: "Pick symptoms", d: "Point at a region of the body, then choose what you feel.", s: <StepPickScene /> },
              { n: "02", t: "See predictions", d: "Likely conditions, ranked, with a confidence for each.", s: <StepPredictScene /> },
              { n: "03", t: "See why", d: "Every symptom’s push for or against, with the reason.", s: <StepWhyScene /> },
            ].map((step, i) => (
              <Reveal as="li" key={step.n} delay={i * 0.08} className="hud p-7">
                <Corners only={["tl", "br"]} />
                <div className="flex items-center justify-between">
                  <span className="font-mono text-4xl font-bold text-cyan">{step.n}</span>
                  <span className="label">Looping preview</span>
                </div>
                <h3 className="mt-5 font-display text-xl font-semibold tracking-[0.08em] uppercase">{step.t}</h3>
                <p className="mt-2 text-[15px] text-soft">{step.d}</p>
                <div className="mt-6">{step.s}</div>
              </Reveal>
            ))}
          </ol>
        </section>

        {/* ---------- 3. Explainability showcase ---------- */}
        <section aria-labelledby="explain-title" className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-8 lg:py-20">
          <Reveal className="mb-10 grid items-end gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <SectionHead n="02" kicker="Explainability" title="Every prediction shows its work." id="explain-title" />
            </div>
            <p className="text-base leading-relaxed text-soft lg:col-span-5">
              Lines run from each symptom to the conditions it affects. Thicker means stronger. Green pushes a condition up, red
              pushes it down — and symptoms that change nothing are shown, not hidden.
            </p>
          </Reveal>
          <Reveal className="hud h-[460px] p-6">
            <Corners />
            <ShowcaseGraph />
          </Reveal>
        </section>

        {/* ---------- 4. Feature grid ---------- */}
        <section aria-labelledby="features-title" className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-8 lg:py-20">
          <Reveal className="mb-10">
            <SectionHead n="03" kicker="Features" title="Built to be questioned." id="features-title" />
          </Reveal>
          <div className="grid gap-6 lg:grid-cols-12 lg:grid-rows-2">
            <Reveal as="article" className="hud flex flex-col p-7 lg:col-span-5 lg:row-span-2">
              <Corners />
              <p className="label">Feature · Body map</p>
              <h3 className="mt-3 font-display text-3xl font-bold tracking-[0.05em] uppercase">Point at where it hurts</h3>
              <p className="mt-3 text-[15px] text-soft">
                A holographic body with eight regions. Hover to highlight, click to choose symptoms. A 2D map is always one tap away
                for keyboards and phones.
              </p>
              <div className="relative mt-6 min-h-[280px] flex-1 border border-cyan/12 bg-cyan/[0.03]">
                <HeroBody compact />
              </div>
            </Reveal>
            <Reveal as="article" delay={0.08} className="hud p-7 lg:col-span-7">
              <Corners only={["tl", "br"]} />
              <div className="flex flex-wrap items-start justify-between gap-6">
                <div className="max-w-[46ch]">
                  <p className="label">Feature · What-if mode</p>
                  <h3 className="mt-3 font-display text-2xl font-bold tracking-[0.05em] uppercase">Turn a symptom off. Watch it move.</h3>
                  <p className="mt-2 text-[15px] text-soft">Exclude any symptom and see confidence before and after, side by side.</p>
                </div>
                <WhatIfDemo />
              </div>
            </Reveal>
            <Reveal as="article" delay={0.16} className="hud p-7 lg:col-span-4">
              <p className="label">Feature · Reasoning</p>
              <h3 className="mt-3 font-display text-2xl font-bold tracking-[0.05em] uppercase">Step by step</h3>
              <ol className="mt-4 space-y-3 border-l border-cyan/30 pl-5 text-sm text-soft">
                <li><span className="mr-2 font-mono text-cyan">01</span>Parsed 5 symptoms across 3 regions.</li>
                <li><span className="mr-2 font-mono text-cyan">02</span>Strongest signal: Fever → Influenza.</li>
                <li><span className="mr-2 font-mono text-cyan">03</span>Sneezing lowers Influenza (−0.20).</li>
                <li className="text-text"><span className="mr-2 font-mono text-cyan">04</span>Click any step to see what it refers to.</li>
              </ol>
            </Reveal>
            <Reveal as="article" delay={0.24} className="hud p-7 lg:col-span-3">
              <p className="label">Feature · Follow-ups</p>
              <p className="mt-3 text-[15px] text-text">Did it start suddenly, within a few hours?</p>
              <div className="mt-4 grid grid-cols-3 gap-2" aria-hidden>
                <span className="btn border border-support !px-0 text-support">Yes</span>
                <span className="btn border border-contra !px-0 text-contra">No</span>
                <span className="btn border border-amber !px-0 text-amber">Not sure</span>
              </div>
              <p className="mt-4 text-sm text-soft">
                Each answer re-ranks the result and shows the change: Influenza <span className="font-mono text-support">▲ +12</span>
              </p>
            </Reveal>
          </div>
        </section>

        {/* ---------- 5. Honesty ---------- */}
        <section aria-labelledby="honesty-title" className="mx-auto w-full max-w-[1440px] px-4 py-16 sm:px-8 lg:py-20">
          <Reveal className="hud-quiet grid gap-10 border-l-2 !border-l-amber p-8 lg:grid-cols-12 lg:p-10">
            <div className="lg:col-span-5">
              <SectionHead n="04" kicker="Honesty" title="An educational demo. Not a doctor." id="honesty-title" tone="amber" />
              <p className="mt-5 text-base leading-relaxed text-soft">
                ClearDx shows how a model can explain its reasoning. Its predictions can be wrong, and it is not medical advice.
              </p>
            </div>
            <div className="grid gap-8 sm:grid-cols-2 lg:col-span-7">
              <div>
                <p className="label mb-4 !text-support">What it does</p>
                <ul className="space-y-3 text-[15px]">
                  {["Shows how a model weighs each symptom", "Explains every ranking it makes", "Flags warning signs to take seriously"].map((t) => (
                    <li key={t} className="flex gap-3"><span className="font-mono text-support">+</span>{t}</li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="label mb-4 !text-contra">What it doesn’t</p>
                <ul className="space-y-3 text-[15px]">
                  {["Diagnose you", "Replace a clinician", "Know your medical history"].map((t) => (
                    <li key={t} className="flex gap-3"><span className="font-mono text-contra">−</span>{t}</li>
                  ))}
                </ul>
              </div>
              <p className="border-t border-amber/30 pt-5 text-[15px] sm:col-span-2">
                If you feel unwell or something seems urgent, contact a clinician or your local emergency number.
              </p>
            </div>
          </Reveal>
        </section>

        {/* ---------- 6. Final CTA ---------- */}
        <section aria-labelledby="cta-title" className="relative mx-auto w-full max-w-[1440px] overflow-hidden px-4 py-28 text-center sm:px-8 lg:py-32">
          <div aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 size-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgb(0_240_255/0.1),transparent_65%)]" />
          <Reveal className="relative">
            <h2 id="cta-title" className="font-display text-5xl leading-none font-bold tracking-[0.05em] uppercase sm:text-[64px]">
              Ready to see the <span className="text-cyan glow">reasoning</span>?
            </h2>
            <p className="mt-5 text-lg text-soft">Pick a few symptoms and see every reason behind the result.</p>
            <Link href="/app" className="btn btn-primary mt-10 h-14 px-9 text-sm">
              Launch app <span aria-hidden>→</span>
            </Link>
          </Reveal>
        </section>
      </main>

      {/* ---------- 7. Footer ---------- */}
      <footer className="border-t border-cyan/15">
        <div className="mx-auto flex w-full max-w-[1440px] flex-wrap items-center justify-between gap-6 px-4 py-8 sm:px-8">
          <div className="flex items-center gap-3 text-cyan">
            <LogoMark size={20} />
            <span className="font-display text-lg font-bold tracking-[0.18em] uppercase">ClearDx</span>
          </div>
          <nav aria-label="Footer" className="flex flex-wrap items-center gap-6 text-sm">
            <a href="#how-it-works" className="text-soft hover:text-cyan">How it works</a>
            <Link href="/app" className="text-soft hover:text-cyan">Launch app</Link>
            <a href={GITHUB} className="text-soft hover:text-cyan">Source on GitHub</a>
          </nav>
        </div>
        <Disclaimer className="mx-4 mb-6 sm:mx-8" />
      </footer>
    </div>
  );
}
