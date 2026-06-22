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
      { title: "Sign in — এখন কে ফ্রি??" },
      { name: "description", content: "Log in or sign up with your BRACU student email." },
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

  return (
    <div className="min-h-screen flex items-stretch">
      <div className="hidden md:flex md:w-1/2 surface-mint p-12 flex-col justify-between">
        <Link to="/" className="font-display text-xl text-primary">এখন কে ফ্রি??</Link>
        <div>
          <h1 className="font-display text-5xl text-primary leading-tight">
            Find out who's free <br /> on campus, right now.
          </h1>
          <p className="mt-4 text-primary/70 max-w-md">
            Upload your BRACU routine once. We figure out your free periods, your friends' free periods,
            and your upcoming exams.
          </p>
        </div>
        <p className="text-xs text-primary/60">For BRAC University students · @g.bracu.ac.bd</p>
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
                {t === "login" ? "Log in" : t === "signup" ? "Sign up" : "Forgot?"}
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
    toast.success("Welcome back!");
    nav({ to: "/home" });
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="font-display text-2xl">Log in</h2>
      <Field label="Student email" type="email" value={email} onChange={setEmail} placeholder="name@g.bracu.ac.bd" required />
      <Field label="Password" type="password" value={password} onChange={setPassword} required />
      <button disabled={busy} className="btn-hero w-full py-3 rounded-xl font-medium">
        {busy ? "Signing in…" : "Log in"}
      </button>
      <button type="button" onClick={onForgot} className="text-sm text-primary hover:underline w-full text-center">
        Forgot Password?
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
    if (!BRACU_EMAIL_RE.test(email)) return toast.error("Please use your @g.bracu.ac.bd email");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    if (name.trim().length < 2) return toast.error("Enter your full name");

    setBusy(true);
    const redirect = `${window.location.origin}/home`;
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: redirect, data: { full_name: name.trim() } },
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Account created! Check your inbox for a confirmation email.");
    onDone();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="font-display text-2xl">Create account</h2>
      <Field label="Full name" value={name} onChange={setName} required />
      <Field label="Student email" type="email" value={email} onChange={setEmail} placeholder="name@g.bracu.ac.bd" required />
      <Field label="Password" type="password" value={password} onChange={setPassword} required />
      <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} required />
      <button disabled={busy} className="btn-hero w-full py-3 rounded-xl font-medium">
        {busy ? "Creating…" : "Sign up"}
      </button>
      <p className="text-xs text-muted-foreground text-center">
        Must end with <span className="font-mono">@g.bracu.ac.bd</span>. We'll email you to confirm.
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
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (Number(guess) !== captcha.answer) {
      toast.error("Captcha incorrect. Try again.");
      setCaptcha(makeCaptcha());
      setGuess("");
      return;
    }
    if (!BRACU_EMAIL_RE.test(email)) return toast.error("Use your @g.bracu.ac.bd email");
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Reset link sent. Check your inbox.");
    onBack();
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <h2 className="font-display text-2xl">Reset password</h2>
      <p className="text-sm text-muted-foreground">
        Solve the captcha, then we'll email you a reset link.
      </p>
      <Field label="Student email" type="email" value={email} onChange={setEmail} placeholder="name@g.bracu.ac.bd" required />

      <div className="rounded-xl border bg-secondary p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm font-medium">Captcha</span>
          <button type="button" onClick={() => { setCaptcha(makeCaptcha()); setGuess(""); }} className="text-xs text-primary hover:underline">
            New captcha
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
            placeholder="Answer"
            className="flex-1 px-3 py-2 rounded-lg border bg-card outline-none focus:ring-2 ring-ring"
            required
          />
        </div>
      </div>

      <button disabled={busy} className="btn-hero w-full py-3 rounded-xl font-medium">
        {busy ? "Sending…" : "Send reset link"}
      </button>
      <button type="button" onClick={onBack} className="text-sm text-muted-foreground hover:text-foreground w-full text-center">
        Back to login
      </button>
    </form>
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
