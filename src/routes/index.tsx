import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "এখন কে ফ্রি??" },
      { name: "description", content: "আপনার রুটিন আপলোড করুন এবং দেখুন এই মুহূর্তে কোন বন্ধুরা ফ্রি আছেন।" },
      { property: "og:title", content: "এখন কে ফ্রি??" },
      { property: "og:description", content: "রিয়েল-টাইমে দেখুন এই মুহূর্তে কারা ফ্রি আছেন।" },
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
          <Link to="/auth" search={{ tab: "login" }} className="text-sm text-foreground/70 hover:text-foreground">
            লগ ইন
          </Link>
          <Link to="/auth" search={{ tab: "signup" }} className="btn-hero text-sm px-4 py-2 rounded-lg">
            শুরু করুন
          </Link>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-6 pt-10 md:pt-20 pb-24">
        <section className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <h1 className="font-display text-5xl md:text-6xl font-bold text-primary leading-[1.05]">
              এখন কে <span className="text-[oklch(0.55_0.18_60)]">ফ্রি??</span>
            </h1>
            <p className="mt-5 text-lg text-foreground/70 max-w-lg">
              একবার আপনার রুটিনের PDF আপলোড করুন। আমরা স্বয়ংক্রিয়ভাবে আপনার ফ্রি পিরিয়ড শনাক্ত করব,
              দেখাব এই মুহূর্তে কোন বন্ধুরা ফ্রি আছেন, এবং আসন্ন মিডটার্ম ও ফাইনাল পরীক্ষার রিমাইন্ডার দেব।
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" search={{ tab: "signup" }} className="btn-hero px-6 py-3 rounded-xl font-medium">
                অ্যাকাউন্ট খুলুন
              </Link>
              <Link
                to="/auth"
                search={{ tab: "login" }}
                className="px-6 py-3 rounded-xl border border-primary/20 hover:bg-secondary font-medium"
              >
                আমার অ্যাকাউন্ট আছে
              </Link>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              <span className="font-mono">@g.bracu.ac.bd</span> ইমেইল দিয়ে সাইন আপ করুন।
            </p>
          </div>

          <div className="surface-mint rounded-3xl p-8 ring-soft">
            <div className="bg-card rounded-2xl p-8 shadow-sm text-center">
              <h3 className="font-display text-2xl text-primary">সরাসরি ফ্রি-নাউ</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                একটি বোতামে চাপ দিন — রিয়েল-টাইমে দেখুন এই মুহূর্তে কারা ফ্রি আছেন।
              </p>
            </div>
          </div>
        </section>

        <section className="mt-24 grid md:grid-cols-3 gap-6">
          {[
            { t: "রুটিন আপলোড করুন", d: "USIS রুটিনের PDF দিন — আমরা প্রতিটি ক্লাস, পরীক্ষার তারিখ ও ফ্রি পিরিয়ড স্বয়ংক্রিয়ভাবে শনাক্ত করব।" },
            { t: "এখন কে ফ্রি??", d: "একটি বোতামে চাপ — রিয়েল-টাইমে দেখুন ক্যাম্পাসে এই মুহূর্তে কারা ফ্রি আছেন।" },
            { t: "ইভেন্ট ও পরীক্ষা", d: "সবার জন্য একটি অভিন্ন ক্যালেন্ডার, এবং আপনার নিজের আসন্ন মিডটার্ম ও ফাইনাল পরীক্ষা।" },
          ].map((f) => (
            <div key={f.t} className="bg-card border rounded-2xl p-6 ring-soft">
              <h3 className="font-display font-semibold text-lg">{f.t}</h3>
              <p className="mt-2 text-sm text-foreground/70">{f.d}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        এখন কে ফ্রি??
      </footer>
    </div>
  );
}
