import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({ meta: [{ title: "Reset password — এখন কে ফ্রি??" }] }),
  component: ResetPage,
});

function ResetPage() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const nav = useNavigate();

  useEffect(() => {
    // Supabase recovery link logs the user in with a recovery session.
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 6) return toast.error("At least 6 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Password updated. Please log in.");
    await supabase.auth.signOut();
    nav({ to: "/auth" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 bg-card border rounded-2xl p-6 ring-soft">
        <h1 className="font-display text-2xl">Set new password</h1>
        {!ready && (
          <p className="text-sm text-muted-foreground">
            Open the reset link from your email to continue. If you got here directly, request a new link.
          </p>
        )}
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          className="w-full px-3 py-2.5 rounded-lg border bg-background outline-none focus:ring-2 ring-ring"
          disabled={!ready}
        />
        <input
          type="password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          placeholder="Confirm password"
          className="w-full px-3 py-2.5 rounded-lg border bg-background outline-none focus:ring-2 ring-ring"
          disabled={!ready}
        />
        <button disabled={!ready || busy} className="btn-hero w-full py-3 rounded-xl font-medium disabled:opacity-50">
          {busy ? "Updating…" : "Update password"}
        </button>
      </form>
    </div>
  );
}
