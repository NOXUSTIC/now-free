import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "এখন কে ফ্রি??" },
      { name: "description", content: "তোমার রুটিন আপলোড করো আর দেখো এখন কোন বন্ধুরা ফ্রি আছে।" },
      { property: "og:title", content: "এখন কে ফ্রি??" },
      { property: "og:description", content: "রিয়েল-টাইমে দেখো এখন কারা ফ্রি আছে।" },
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
            শুরু করো
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
              একবার তোমার রুটিন PDF আপলোড করো। আমরা তোমার ফ্রি পিরিয়ড বের করে দেখাবো এখন কারা ফ্রি আছে,
              আর আসন্ন মিড ও ফাইনাল পরীক্ষার রিমাইন্ডার দেবো।
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/auth" search={{ tab: "signup" }} className="btn-hero px-6 py-3 rounded-xl font-medium">
                অ্যাকাউন্ট খোলো
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
              <span className="font-mono">@g.bracu.ac.bd</span> ইমেইল দিয়ে সাইন আপ করো।
            </p>
          </div>

          <div className="surface-mint rounded-3xl p-8 ring-soft">
            <div className="bg-card rounded-2xl p-8 shadow-sm text-center">
              <div className="text-6xl">⚡</div>
              <h3 className="mt-4 font-display text-2xl text-primary">লাইভ ফ্রি-নাউ</h3>
              <p className="mt-2 text-sm text-muted-foreground">
                একটি বাটনে চাপ দাও — রিয়েল-টাইমে দেখো এই মুহূর্তে কারা ফ্রি আছে।
              </p>
            </div>
          </div>
        </section>

        <section className="mt-24 grid md:grid-cols-3 gap-6">
          {[
            { t: "রুটিন আপলোড করো", d: "USIS রুটিন PDF দাও — আমরা প্রতিটি ক্লাস ও পরীক্ষার তারিখ স্বয়ংক্রিয়ভাবে বের করব।", e: "📄" },
            { t: "এখন কে ফ্রি??", d: "একটি বাটনে চাপ — রিয়েল-টাইমে দেখো ক্যাম্পাসে এখন কারা ফ্রি আছে।", e: "⚡" },
            { t: "ইভেন্ট ও পরীক্ষা", d: "সবার জন্য শেয়ার করা ক্যালেন্ডার, আর তোমার নিজের আসন্ন মিড ও ফাইনাল।", e: "🗓️" },
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
        এখন কে ফ্রি??
      </footer>
    </div>
  );
}
