import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/_app/friends")({
  component: FriendsPage,
});

type Profile = { id: string; full_name: string; email: string };
type Friendship = {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: "pending" | "accepted";
};

function FriendsPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  async function load() {
    const [{ data: ps }, { data: fs }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email"),
      supabase.from("friendships").select("*"),
    ]);
    setProfiles((ps as Profile[]) ?? []);
    setFriendships((fs as Friendship[]) ?? []);
  }

  useEffect(() => {
    if (!user) return;
    load();
    const ch = supabase
      .channel("friendships-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const profileById = useMemo(() => {
    const m = new Map<string, Profile>();
    for (const p of profiles) m.set(p.id, p);
    return m;
  }, [profiles]);

  const relWith = (otherId: string) =>
    friendships.find(
      (f) =>
        (f.requester_id === user!.id && f.addressee_id === otherId) ||
        (f.addressee_id === user!.id && f.requester_id === otherId),
    );

  const accepted = friendships.filter((f) => f.status === "accepted");
  const incoming = friendships.filter((f) => f.status === "pending" && f.addressee_id === user?.id);
  const outgoing = friendships.filter((f) => f.status === "pending" && f.requester_id === user?.id);

  const q = query.trim().toLowerCase();
  const searchResults = q
    ? profiles
        .filter((p) => p.id !== user?.id)
        .filter(
          (p) =>
            p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q),
        )
        .slice(0, 20)
    : [];

  async function sendRequest(otherId: string) {
    if (!user) return;
    setBusy(otherId);
    try {
      const { error } = await supabase
        .from("friendships")
        .insert({ requester_id: user.id, addressee_id: otherId, status: "pending" });
      if (error) throw error;
      toast.success("বন্ধুত্বের অনুরোধ পাঠানো হয়েছে");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "অনুরোধ পাঠানো যায়নি");
    } finally {
      setBusy(null);
    }
  }

  async function accept(f: Friendship) {
    setBusy(f.id);
    try {
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted" })
        .eq("id", f.id);
      if (error) throw error;
      toast.success("বন্ধু হিসেবে যোগ করা হয়েছে");
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "গ্রহণ করা যায়নি");
    } finally {
      setBusy(null);
    }
  }

  async function remove(f: Friendship) {
    setBusy(f.id);
    try {
      const { error } = await supabase.from("friendships").delete().eq("id", f.id);
      if (error) throw error;
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "মুছে ফেলা যায়নি");
    } finally {
      setBusy(null);
    }
  }

  function initial(p?: Profile) {
    return (p?.full_name || p?.email || "?")[0]?.toUpperCase();
  }

  function otherOf(f: Friendship): Profile | undefined {
    const otherId = f.requester_id === user?.id ? f.addressee_id : f.requester_id;
    return profileById.get(otherId);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-8">
      <h1 className="font-display text-3xl">বন্ধু</h1>
      <p className="mt-2 text-muted-foreground">
        নাম দিয়ে অন্য শিক্ষার্থীদের অনুসন্ধান করে বন্ধু হিসেবে যোগ করুন। শুধুমাত্র আপনার বন্ধুরাই "এখন কে ফ্রি??" তালিকায় দেখা যাবেন।
      </p>

      <div className="mt-6">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="নাম বা ইমেইল দিয়ে অনুসন্ধান করুন…"
          className="w-full px-4 py-2.5 rounded-xl border bg-card focus:outline-none focus:ring-2 focus:ring-primary/40"
        />
        {q && (
          <ul className="mt-3 space-y-2">
            {searchResults.length === 0 ? (
              <li className="text-sm text-muted-foreground px-2">কোনো ব্যবহারকারী পাওয়া যায়নি।</li>
            ) : (
              searchResults.map((p) => {
                const rel = relWith(p.id);
                return (
                  <li key={p.id} className="flex items-center gap-3 bg-card border rounded-xl p-3">
                    <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                      {initial(p)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">{p.full_name || p.email.split("@")[0]}</div>
                      <div className="text-xs text-muted-foreground truncate">{p.email}</div>
                    </div>
                    {rel?.status === "accepted" ? (
                      <span className="text-xs text-muted-foreground">বন্ধু</span>
                    ) : rel?.status === "pending" ? (
                      <span className="text-xs text-muted-foreground">
                        {rel.requester_id === user?.id ? "অনুরোধ পাঠানো" : "আপনাকে অনুরোধ পাঠানো হয়েছে"}
                      </span>
                    ) : (
                      <button
                        onClick={() => sendRequest(p.id)}
                        disabled={busy === p.id}
                        className="btn-hero px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
                      >
                        যোগ করুন
                      </button>
                    )}
                  </li>
                );
              })
            )}
          </ul>
        )}
      </div>

      {incoming.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl mb-3">আগত অনুরোধ · {incoming.length}</h2>
          <ul className="space-y-2">
            {incoming.map((f) => {
              const p = otherOf(f);
              return (
                <li key={f.id} className="flex items-center gap-3 bg-card border rounded-xl p-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                    {initial(p)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p?.full_name || p?.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{p?.email}</div>
                  </div>
                  <button
                    onClick={() => accept(f)}
                    disabled={busy === f.id}
                    className="btn-hero px-3 py-1.5 rounded-lg text-sm disabled:opacity-50"
                  >
                    গ্রহণ করুন
                  </button>
                  <button
                    onClick={() => remove(f)}
                    disabled={busy === f.id}
                    className="px-3 py-1.5 rounded-lg text-sm border hover:bg-secondary disabled:opacity-50"
                  >
                    প্রত্যাখ্যান
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {outgoing.length > 0 && (
        <section className="mt-8">
          <h2 className="font-display text-xl mb-3">পাঠানো অনুরোধ · {outgoing.length}</h2>
          <ul className="space-y-2">
            {outgoing.map((f) => {
              const p = otherOf(f);
              return (
                <li key={f.id} className="flex items-center gap-3 bg-card border rounded-xl p-3">
                  <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center font-semibold">
                    {initial(p)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p?.full_name || p?.email}</div>
                    <div className="text-xs text-muted-foreground truncate">অপেক্ষমাণ</div>
                  </div>
                  <button
                    onClick={() => remove(f)}
                    disabled={busy === f.id}
                    className="px-3 py-1.5 rounded-lg text-sm border hover:bg-secondary disabled:opacity-50"
                  >
                    বাতিল
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <h2 className="font-display text-xl mb-3">আপনার বন্ধু · {accepted.length}</h2>
        {accepted.length === 0 ? (
          <p className="text-sm text-muted-foreground">এখনও কোনো বন্ধু নেই।</p>
        ) : (
          <ul className="space-y-2">
            {accepted.map((f) => {
              const p = otherOf(f);
              return (
                <li key={f.id} className="flex items-center gap-3 bg-card border rounded-xl p-3">
                  <div className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-semibold">
                    {initial(p)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{p?.full_name || p?.email}</div>
                    <div className="text-xs text-muted-foreground truncate">{p?.email}</div>
                  </div>
                  <button
                    onClick={() => remove(f)}
                    disabled={busy === f.id}
                    className="px-3 py-1.5 rounded-lg text-sm border hover:bg-secondary disabled:opacity-50"
                  >
                    সরিয়ে ফেলুন
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
