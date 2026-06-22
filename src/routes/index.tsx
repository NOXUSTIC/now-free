import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "এখন কে ফ্রি?? — Find free classmates at BRACU" },
      { name: "description", content: "Upload your BRACU routine and instantly see which classmates are free right now." },
      { property: "og:title", content: "এখন কে ফ্রি??" },
      { property: "og:description", content: "Real-time free-period finder for BRAC University students." },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const nav = useNavigate();
  useEffect(() => { if (!loading && user) nav({ to: "/home" }); }, [user, loading, nav]);

  return (
    <div className="min-h-screen">
      <header className="px-6 py-5 flex items-center justify-between max-w-6xl mx-auto">
        <div className="font-display text-xl font-semibold text-primary">এখন কে ফ্রি??</div>
        <nav className="flex items-center gap-3">
          <Link to="/auth" search={{ tab: "login" }} className="text-sm text-foreground/70 hover:text-foreground">Log in</Link>
          <Link to="/auth" search={{ tab: "signup" }} className="btn-hero text-sm px-4 py-2 rounded-lg">Get started</Link>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-10 md:pt-20 pb-24">
        <section className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <span className="inline-block text-xs font-medium tracking-wider uppercase text-primary/70 bg-accent/40 rounded-full px-3 py-1">
              For BRAC University students
            </span>
            <h1 className="mt-5 font-display text-5xl md:text-6xl font-bold text-primary leading-[1.05]">
              এখন কে <span className="text-[oklch(0.55_0.18_60)]">ফ্রি??</span>
            </h1>
            <p className="mt-5 text-lg text-foreground/70 max-w-lg">
              Upload your routine PDF once. We figure out your free periods, show who else on campus is free
              right now, and remind you about upcoming mids and finals.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" search={{ tab: "signup" }} className="btn-hero px-6 py-3 rounded-xl font-medium">
                Create an account
              </Link>
              <Link to="/auth" search={{ tab: "login" }} className="px-6 py-3 rounded-xl border border-primary/20 hover:bg-secondary font-medium">
                I already have one
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">Sign up with your <span className="font-mono">@g.bracu.ac.bd</span> email.</p>
          </div>

          <div className="surface-mint rounded-3xl p-8 ring-soft">
            <div className="bg-card rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-muted-foreground">Tuesday · 11:42 AM</span>
                <span className="text-xs px-2 py-1 rounded-full bg-accent text-accent-foreground">3 free now</span>
              </div>
              {[
                { n: "Rifa", c: "Free till 12:30 PM" },
                { n: "Tanvir", c: "Free till 1:50 PM" },
                { n: "Mehedi", c: "Free till 12:30 PM" },
              ].map((u) => (
                <div key={u.n} className="flex items-center gap-3 py-3 border-t first:border-t-0">
                  <div className="w-9 h-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-semibold">
                    {u.n[0]}
                  </div>
                  <div className="flex-1">
                    <div className="font-medium">{u.n}</div>
                    <div className="text-xs text-muted-foreground">{u.c}</div>
                  </div>
                  <span className="w-2 h-2 rounded-full bg-[oklch(0.65_0.17_150)]" />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-24 grid md:grid-cols-3 gap-6">
          {[
            { t: "Upload your routine", d: "Drop your USIS routine PDF. We auto-extract every class period and exam date.", e: "📄" },
            { t: "এখন কে ফ্রি??", d: "Tap one button to see who's free across campus, right now, in real time.", e: "⚡" },
            { t: "Events & exams", d: "Shared calendar for everyone, plus your own upcoming mids and finals.", e: "🗓️" },
          ].map((f) => (
            <div key={f.t} className="bg-card border rounded-2xl p-6 ring-soft">
              <div className="text-3xl">{f.e}</div>
              <h3 className="mt-3 font-display font-semibold text-lg">{f.t}</h3>
              <p className="mt-1 text-sm text-foreground/70">{f.d}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        Built for BRACU students · এখন কে ফ্রি??
      </footer>
    </div>
  );
}
