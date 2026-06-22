import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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

function nextClassFor(userSlots: Slot[], dayIdx: number, time: string): Slot | null {
  const todays = userSlots.filter((s) => s.day_of_week === dayIdx && s.start_time > time).sort((a, b) => a.start_time.localeCompare(b.start_time));
  return todays[0] ?? null;
}

function FreePage() {
  const { user } = useAuth();
  const [revealed, setRevealed] = useState(false);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [allSlots, setAllSlots] = useState<Slot[]>([]);
  const [tick, setTick] = useState(0);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!revealed) return;
    const id = setInterval(() => setTick((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, [revealed]);

  async function reveal() {
    setRevealed(true);
    setLoading(true);
    const [{ data: ps }, { data: ss }] = await Promise.all([
      supabase.from("profiles").select("id,full_name,email"),
      supabase.from("routine_slots").select("*"),
    ]);
    setProfiles((ps as Profile[]) ?? []);
    setAllSlots((ss as Slot[]) ?? []);
    setLoading(false);
  }

  // re-fetch every 60s to catch new uploads
  useEffect(() => {
    if (!revealed) return;
    const id = setInterval(reveal, 60000);
    return () => clearInterval(id);
  }, [revealed]);

  const now = nowInDhaka();
  const today = dhakaDayIndex(now);
  const time = dhakaTimeString(now);
  void tick;

  // Group slots by user
  const slotsByUser = new Map<string, Slot[]>();
  for (const s of allSlots) {
    const arr = slotsByUser.get(s.user_id) ?? [];
    arr.push(s);
    slotsByUser.set(s.user_id, arr);
  }

  // Free = profile exists & has any routine slots & none of those slots is currently active
  const freeUsers = profiles
    .filter((p) => slotsByUser.has(p.id))
    .map((p) => {
      const slots = slotsByUser.get(p.id)!;
      const inClass = slots.find((s) => s.day_of_week === today && s.start_time <= time && s.end_time > time);
      const next = nextClassFor(slots, today, time);
      return { p, inClass, next };
    })
    .filter((x) => !x.inClass)
    .sort((a, b) => (a.p.id === user?.id ? -1 : b.p.id === user?.id ? 1 : a.p.full_name.localeCompare(b.p.full_name)));

  return (
    <div className="max-w-3xl mx-auto px-4 md:px-6 py-10">
      <div className="text-center">
        <p className="text-sm text-muted-foreground">{DAY_NAMES_BN[today]}বার · {fmt12(time.slice(0,5))}</p>
        <h1 className="mt-2 font-display text-4xl md:text-5xl font-bold text-primary">এখন কে ফ্রি??</h1>
      </div>

      {!revealed ? (
        <div className="mt-12 text-center">
          <button onClick={reveal} className="btn-hero text-xl px-10 py-6 rounded-2xl font-display font-bold shadow-xl hover:scale-[1.02] transition">
            এখন কে ফ্রি??
          </button>
          <p className="mt-4 text-sm text-muted-foreground">Tap to see classmates currently free.</p>
        </div>
      ) : (
        <div className="mt-10">
          {loading && profiles.length === 0 ? (
            <p className="text-center text-muted-foreground">Looking…</p>
          ) : freeUsers.length === 0 ? (
            <div className="text-center bg-card border rounded-2xl p-8 ring-soft">
              <p className="text-muted-foreground">No one is registered as free right now.</p>
              <p className="text-xs text-muted-foreground mt-2">
                Note: only students who've uploaded their routine appear here.
              </p>
              <Link to="/routine" className="mt-4 inline-block text-primary text-sm hover:underline">
                Upload your routine →
              </Link>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-muted-foreground">{freeUsers.length} free right now</span>
                <button onClick={reveal} className="text-xs text-primary hover:underline">Refresh</button>
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
                        {p.id === user?.id && <span className="ml-2 text-xs text-muted-foreground">(you)</span>}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {next ? `Free until ${fmt12(next.start_time)} (${next.course_code})` : "Free for the rest of the day"}
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
