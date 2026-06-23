import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { BRACU_EMAIL_RE, useAuth } from "@/lib/auth";
import { toast } from "sonner";

const searchSchema = z.object({
  tab: z.enum(["login", "signup", "forgot"]).optional(),
});

export const Route = createFileRoute("/auth")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "সাইন ইন — এখন কে ফ্রি??" },
      { name: "description", content: "তোমার স্টুডেন্ট ইমেইল দিয়ে লগ ইন বা সাইন আপ করো।" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const search = useSearch({ from: "/auth" });
  const [tab, setTab] = useState<"login" | "signup" | "forgot">(search.tab ?? "login");
  const { user, loading } = useAuth();
  const nav = useNavigate();

  useEffect(() => {
    if (!loading && user) nav({ to: "/home" });
  }, [loading, user, nav]);

  const tabLabel = (t: "login" | "signup" | "forgot") =>
    t === "login" ? "লগ ইন" : t === "signup" ? "সাইন আপ" : "পাসওয়ার্ড?";

  return (
    <div className="min-h-screen flex items-stretch">
      <div className="hidden md:flex md:w-1/2 surface-mint p-12 flex-col justify-between">
        <Link to="/" className="font-display text-xl text-primary">এখন কে ফ্রি??</Link>
        <div>
          <h1 className="font-display text-5xl text-primary leading-tight">
            দেখো এই মুহূর্তে <br /> কারা ফ্রি আছে।
          </h1>
          <p className="mt-4 text-primary/70 max-w-md">
            একবার তোমার রুটিন আপলোড করো। তোমার ফ্রি পিরিয়ড, বন্ধুদের ফ্রি পিরিয়ড আর
            আসন্ন পরীক্ষার রিমাইন্ডার সব এক জায়গায়।
          </p>
        </div>
        <p className="text-xs text-primary/60">@g.bracu.ac.bd</p>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 bg-background">
        <div className="w-full max-w-md">
          <div className="md:hidden mb-6 text-center">
            <Link to="/" className="font-display text-2xl text-primary">এখন কে ফ্রি??</Link>
          </div>

          <div className="flex gap-1 p-1 bg-secondary rounded-xl mb-6">
            {(["login", "signup", "forgot"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition ${
                  tab === t ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {tabLabel(t)}
              </button>
            ))}
          </div>

          {tab === "login" && <LoginForm onForgot={() => setTab("forgot")} />}
          {tab === "signup" && <SignupForm onDone={() => setTab("login")} />}
          {tab === "forgot" && <ForgotForm onBack={() => setTab("login")} />}
        </div>
      </div>
    </div>
  );
}

function LoginForm({ onForgot }: { onForgot: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("আবার স্বাগতম!");
    nav({ to: "/home" });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="font-display text-2xl">লগ ইন</h2>
      <Field label="স্টুডেন্ট ইমেইল" type="email" value={email} onChange={setEmail} placeholder="name@g.bracu.ac.bd" required />
      <Field label="পাসওয়ার্ড" type="password" value={password} onChange={setPassword} required />
      <button disabled={busy} className="btn-hero w-full py-3 rounded-xl font-medium">
        {busy ? "সাইন ইন হচ্ছে…" : "লগ ইন"}
      </button>
      <button type="button" onClick={onForgot} className="text-sm text-primary hover:underline w-full text-center">
        পাসওয়ার্ড ভুলে গেছ?
      </button>
    </form>
  );
}

function SignupForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!BRACU_EMAIL_RE.test(email)) return toast.error("দয়া করে তোমার @g.bracu.ac.bd ইমেইল ব্যবহার করো");
    if (password.length < 6) return toast.error("পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে");
    if (password !== confirm) return toast.error("পাসওয়ার্ড মিলছে না");
    if (name.trim().length < 2) return toast.error("তোমার পুরো নাম লেখো");

    setBusy(true);
    const redirect = `${window.location.origin}/home`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirect, data: { full_name: name.trim() } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("অ্যাকাউন্ট তৈরি হয়েছে! ইমেইলে কনফার্মেশন লিঙ্ক চেক করো।");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="font-display text-2xl">অ্যাকাউন্ট খোলো</h2>
      <Field label="পুরো নাম" value={name} onChange={setName} required />
      <Field label="স্টুডেন্ট ইমেইল" type="email" value={email} onChange={setEmail} placeholder="name@g.bracu.ac.bd" required />
      <Field label="পাসওয়ার্ড" type="password" value={password} onChange={setPassword} required />
      <Field label="পাসওয়ার্ড নিশ্চিত করো" type="password" value={confirm} onChange={setConfirm} required />
      <button disabled={busy} className="btn-hero w-full py-3 rounded-xl font-medium">
        {busy ? "তৈরি হচ্ছে…" : "সাইন আপ"}
      </button>
      <p className="text-xs text-muted-foreground text-center">
        ইমেইল শেষ হতে হবে <span className="font-mono">@g.bracu.ac.bd</span> দিয়ে। কনফার্মেশন ইমেইল পাঠানো হবে।
      </p>
    </form>
  );
}

function makeCaptcha() {
  const a = Math.floor(Math.random() * 9) + 2;
  const b = Math.floor(Math.random() * 9) + 2;
  return { a, b, answer: a + b };
}

function ForgotForm({ onBack }: { onBack: () => void }) {
  const [email, setEmail] = useState("");
  const [captcha, setCaptcha] = useState(makeCaptcha);
  const [guess, setGuess] = useState("");
  const [solved, setSolved] = useState(false);
  const [busy, setBusy] = useState(false);

  function verifyCaptcha(e: React.FormEvent) {
    e.preventDefault();
    if (Number(guess) !== captcha.answer) {
      toast.error("ক্যাপচা ভুল হয়েছে। আবার চেষ্টা করো।");
      setCaptcha(makeCaptcha());
      setGuess("");
      return;
    }
    setSolved(true);
    toast.success("ক্যাপচা সঠিক। এবার তোমার ইমেইল দাও।");
  }

  async function sendReset(e: React.FormEvent) {
    e.preventDefault();
    if (!BRACU_EMAIL_RE.test(email)) return toast.error("তোমার @g.bracu.ac.bd ইমেইল ব্যবহার করো");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("রিসেট লিঙ্ক পাঠানো হয়েছে। ইনবক্স চেক করো।");
    onBack();
  }

  return (
    <div className="space-y-4">
      <h2 className="font-display text-2xl">পাসওয়ার্ড রিসেট</h2>
      <p className="text-sm text-muted-foreground">
        {solved
          ? "ক্যাপচা সঠিক। এবার ইমেইল দিয়ে রিসেট লিঙ্ক নাও।"
          : "প্রথমে নিচের ক্যাপচাটি সমাধান করো। সঠিক হলে পাসওয়ার্ড রিসেট লিঙ্ক পাঠানো হবে।"}
      </p>

      {!solved ? (
        <form onSubmit={verifyCaptcha} className="space-y-4">
          <div className="rounded-xl border bg-secondary p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">ক্যাপচা</span>
              <button
                type="button"
                onClick={() => { setCaptcha(makeCaptcha()); setGuess(""); }}
                className="text-xs text-primary hover:underline"
              >
                নতুন ক্যাপচা
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-display text-2xl tracking-wider select-none bg-card px-4 py-2 rounded-lg border">
                {captcha.a} + {captcha.b} = ?
              </span>
              <input
                inputMode="numeric"
                value={guess}
                onChange={(e) => setGuess(e.target.value)}
                placeholder="উত্তর"
                className="flex-1 px-3 py-2 rounded-lg border bg-card outline-none focus:ring-2 ring-ring"
                required
              />
            </div>
          </div>
          <button className="btn-hero w-full py-3 rounded-xl font-medium">যাচাই করো</button>
          <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground w-full text-center">
            লগ ইনে ফিরে যাও
          </button>
        </form>
      ) : (
        <form onSubmit={sendReset} className="space-y-4">
          <Field label="স্টুডেন্ট ইমেইল" type="email" value={email} onChange={setEmail} placeholder="name@g.bracu.ac.bd" required />
          <button disabled={busy} className="btn-hero w-full py-3 rounded-xl font-medium">
            {busy ? "পাঠানো হচ্ছে…" : "রিসেট লিঙ্ক পাঠাও"}
          </button>
          <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground w-full text-center">
            লগ ইনে ফিরে যাও
          </button>
        </form>
      )}
    </div>
  );
}

function Field({
  label, value, onChange, type = "text", placeholder, required,
}: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-foreground/80">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="mt-1 w-full px-3 py-2.5 rounded-lg border bg-card outline-none focus:ring-2 ring-ring transition"
      />
    </label>
  );
}
