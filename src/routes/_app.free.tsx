import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { DAY_NAMES_BN, dhakaDayIndex, dhakaTimeString, fmt12, nowInDhaka } from "@/lib/dhaka-time";

export const Route = createFileRoute("/_app/free")({
  component: FreePage,
});

type Profile = { id: string; full_name: string; email: string };
type Slot = {
  id: string; user_id: string; day_of_week: number; start_time: string; end_time: string;
  course_code: string; section: string; room: string;
};
type Friendship = {
  id: string; requester_id: string; addressee_id: string; status: "pending" | "accepted";
};

function nextClassFor(userSlots: Slot[], dayIdx: number, time: string): Slot | null {
  const todays = userSlots
    .filter((s) => s.day_of_week === dayIdx && s.start_time > time)
    .sort((a, b) => a.start_time.localeCompare(b.start_time));
  return todays[0] ?? null;
}

function FreePage() {
  const { user } = useAuth();
  const [revealed, setRevealed] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allSlots, setAllSlots] = useState<Slot[]>([]);
  const [friendships, setFriendships] = useState<Friendship[]>([]);
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function loadData() {
    setLoading(true);
    const [{ data: ps }, { data: ss }, { data: fs }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email"),
      supabase.from("routine_slots").select("*"),
      supabase.from("friendships").select("*").eq("status", "accepted"),
    ]);
    setProfiles((ps as Profile[]) ?? []);
    setAllSlots((ss as Slot[]) ?? []);
    setFriendships((fs as Friendship[]) ?? []);
    setLoading(false);
  }

  async function reveal() {
    setRevealed(true);
    await loadData();
  }

  // Presence-driven realtime: sync/join/leave + DB changes. No fixed polling.
  useEffect(() => {
    if (!revealed || !user) return;

    const channel = supabase.channel("free-now-presence", {
      config: { presence: { key: user.id } },
    });

    const syncOnline = () => {
      const state = channel.presenceState();
      setOnlineIds(new Set(Object.keys(state)));
    };

    channel
      .on("presence", { event: "sync" }, syncOnline)
      .on("presence", { event: "join" }, syncOnline)
      .on("presence", { event: "leave" }, syncOnline)
      .on("postgres_changes", { event: "*", schema: "public", table: "routine_slots" }, () => {
        loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles" }, () => {
        loadData();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => {
        loadData();
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({ online_at: new Date().toISOString() });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [revealed, user]);

  // Recompute only at the next class-boundary instant (no fixed interval).
  useEffect(() => {
    if (!revealed) return;
    const now = nowInDhaka();
    const today = dhakaDayIndex(now);
    const time = dhakaTimeString(now);
    const boundaries = new Set<string>();
    for (const s of allSlots) {
      if (s.day_of_week !== today) continue;
      if (s.start_time > time) boundaries.add(s.start_time);
      if (s.end_time > time) boundaries.add(s.end_time);
    }
    const next = [...boundaries].sort()[0];
    let ms: number;
    if (next) {
      const [h, m, sec] = next.split(":").map(Number);
      const target = new Date(now);
      target.setHours(h, m, sec || 0, 0);
      ms = Math.max(1000, target.getTime() - now.getTime() + 200);
    } else {
      // No more class today — wake at midnight to refresh the day index.
      const midnight = new Date(now);
      midnight.setHours(24, 0, 5, 0);
      ms = midnight.getTime() - now.getTime();
    }
    timerRef.current = setTimeout(() => setTick((t) => t + 1), ms);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [revealed, tick, allSlots]);

  const now = nowInDhaka();
  const today = dhakaDayIndex(now);
  const time = dhakaTimeString(now);
  void tick;

  const slotsByUser = useMemo(() => {
    const m = new Map<string, Slot[]>();
    for (const s of allSlots) {
      const arr = m.get(s.user_id) ?? [];
      arr.push(s);
      m.set(s.user_id, arr);
    }
    return m;
  }, [allSlots]);

  const friendIds = useMemo(() => {
    const s = new Set<string>();
    if (!user) return s;
    for (const f of friendships) {
      if (f.status !== "accepted") continue;
      s.add(f.requester_id === user.id ? f.addressee_id : f.requester_id);
    }
    s.add(user.id);
    return s;
  }, [friendships, user]);

  const freeUsers = profiles
    .filter((p) => friendIds.has(p.id) && slotsByUser.has(p.id) && onlineIds.has(p.id))
    .map((p) => {
      const slots = slotsByUser.get(p.id)!;
      const inClass = slots.find(
        (s) => s.day_of_week === today && s.start_time <= time && s.end_time > time,
      );
      const next = nextClassFor(slots, today, time);
      return { p, inClass, next };
    })
    .filter((x) => !x.inClass)
    .sort((a, b) =>
      a.p.id === user?.id ? -1 : b.p.id === user?.id ? 1 : a.p.full_name.localeCompare(b.p.full_name),
    );

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-10">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">
          {DAY_NAMES_BN[today]}বার · {fmt12(time.slice(0, 5))}
        </p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold text-primary">এখন কে ফ্রি??</h1>
      </div>

      {!revealed ? (
        <div className="mt-12 text-center">
          <button
            onClick={reveal}
            className="btn-hero text-xl px-10 py-6 rounded-2xl font-display font-bold shadow-xl hover:scale-[1.02] transition"
          >
            এখন কে ফ্রি??
          </button>
          <p className="mt-4 text-sm text-muted-foreground">
            বোতামটিতে চাপ দিয়ে দেখুন এই মুহূর্তে কারা ফ্রি আছেন।
          </p>
        </div>
      ) : (
        <div className="mt-10">
          {loading && profiles.length === 0 ? (
            <p className="text-center text-muted-foreground">অনুসন্ধান চলছে…</p>
          ) : freeUsers.length === 0 ? (
            <div className="text-center bg-card border rounded-2xl p-8 ring-soft">
              <p className="text-muted-foreground">এই মুহূর্তে কেউ অনলাইনে এবং ফ্রি নেই।</p>
              <p className="text-xs text-muted-foreground mt-2">
                যাঁরা রুটিন আপলোড করেছেন এবং এই মুহূর্তে অনলাইনে আছেন, শুধু তাঁদেরই দেখানো হবে।
              </p>
              <Link to="/routine" className="mt-4 inline-block text-primary text-sm hover:underline">
                আপনার রুটিন আপলোড করুন
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">
                  এই মুহূর্তে {freeUsers.length} জন ফ্রি · সরাসরি
                </span>
                <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-[oklch(0.7_0.18_150)] animate-pulse" />
                  রিয়েল-টাইম
                </span>
              </div>
              <ul className="space-y-2">
                {freeUsers.map(({ p, next }) => (
                  <li key={p.id} className="bg-card border rounded-xl p-4 flex items-center gap-3 ring-soft">
                    <div className="w-11 h-11 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-display font-semibold text-lg">
                      {(p.full_name || p.email)[0]?.toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium">
                        {p.full_name || p.email.split("@")[0]}
                        {p.id === user?.id && <span className="ml-2 text-xs text-muted-foreground">(আপনি)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {next
                          ? `${fmt12(next.start_time)} পর্যন্ত ফ্রি (${next.course_code})`
                          : "আজকের বাকি সময় ফ্রি"}
                      </div>
                    </div>
                    <span className="w-2.5 h-2.5 rounded-full bg-[oklch(0.7_0.18_150)] animate-pulse" />
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
