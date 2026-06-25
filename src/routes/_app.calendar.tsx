import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { fmt12, nowInDhaka } from "@/lib/dhaka-time";

export const Route = createFileRoute("/_app/calendar")({
  component: CalendarPage,
});

type EventRow = {
  id: string; creator_id: string; creator_name: string;
  title: string; description: string; event_date: string;
  start_time: string | null; end_time: string | null; location: string;
};

const MONTHS_BN = ["জানুয়ারি","ফেব্রুয়ারি","মার্চ","এপ্রিল","মে","জুন","জুলাই","আগস্ট","সেপ্টেম্বর","অক্টোবর","নভেম্বর","ডিসেম্বর"];
const DOW_BN = ["রবি","সোম","মঙ্গল","বুধ","বৃহঃ","শুক্র","শনি"];

function startOfMonth(d: Date) { return new Date(d.getFullYear(), d.getMonth(), 1); }
function addMonths(d: Date, n: number) { return new Date(d.getFullYear(), d.getMonth() + n, 1); }
function fmtDate(d: Date) { return d.toISOString().slice(0, 10); }

function CalendarPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [cursor, setCursor] = useState(startOfMonth(nowInDhaka()));
  const [selected, setSelected] = useState(fmtDate(nowInDhaka()));
  const [showCreate, setShowCreate] = useState(false);

  const { data: events = [] } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("event_date").order("start_time");
      if (error) throw error;
      return data as EventRow[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("events-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "events" }, () => {
        qc.invalidateQueries({ queryKey: ["events"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const monthStart = cursor;
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
  const firstWeekday = monthStart.getDay();
  const daysInMonth = monthEnd.getDate();
  const cells: (Date | null)[] = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
  while (cells.length % 7 !== 0) cells.push(null);

  const eventsByDate = new Map<string, EventRow[]>();
  for (const e of events) {
    const arr = eventsByDate.get(e.event_date) ?? [];
    arr.push(e);
    eventsByDate.set(e.event_date, arr);
  }

  const todayStr = fmtDate(nowInDhaka());
  const selectedEvents = eventsByDate.get(selected) ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl">ক্যালেন্ডার</h1>
        <button onClick={() => setShowCreate(true)} className="btn-hero px-4 py-2 rounded-xl text-sm">নতুন ইভেন্ট</button>
      </div>

      <div className="mt-6 grid md:grid-cols-[1fr_320px] gap-6">
        <div className="bg-card border rounded-2xl p-4 ring-soft">
          <div className="flex items-center justify-between mb-3">
            <button onClick={() => setCursor(addMonths(cursor, -1))} className="px-3 py-1 hover:bg-secondary rounded text-sm">পূর্ববর্তী</button>
            <div className="font-display font-semibold">
              {MONTHS_BN[cursor.getMonth()]} {cursor.getFullYear()}
            </div>
            <button onClick={() => setCursor(addMonths(cursor, 1))} className="px-3 py-1 hover:bg-secondary rounded text-sm">পরবর্তী</button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs text-muted-foreground mb-1">
            {DOW_BN.map((d, i) => <div key={i}>{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, i) => {
              if (!cell) return <div key={i} className="aspect-square" />;
              const ds = fmtDate(cell);
              const has = eventsByDate.has(ds);
              const isToday = ds === todayStr;
              const isSel = ds === selected;
              return (
                <button
                  key={i}
                  onClick={() => setSelected(ds)}
                  className={`aspect-square rounded-lg text-sm relative transition ${
                    isSel ? "bg-primary text-primary-foreground" :
                    isToday ? "bg-accent text-accent-foreground" :
                    "hover:bg-secondary"
                  }`}
                >
                  {cell.getDate()}
                  {has && !isSel && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-[oklch(0.55_0.18_60)]" />}
                </button>
              );
            })}
          </div>
        </div>

        <div className="bg-card border rounded-2xl p-4 ring-soft">
          <h2 className="font-display font-semibold mb-1">{selected}</h2>
          <p className="text-xs text-muted-foreground mb-4">{selectedEvents.length}টি ইভেন্ট</p>
          {selectedEvents.length === 0 ? (
            <p className="text-sm text-muted-foreground">কোনো ইভেন্ট নেই। উপরে "নতুন ইভেন্ট" বোতামে চাপ দিয়ে যোগ করুন।</p>
          ) : (
            <ul className="space-y-2">
              {selectedEvents.map((e) => (
                <li key={e.id} className="border rounded-xl p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{e.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {e.creator_name || "—"}
                        {e.start_time && ` · ${fmt12(e.start_time)}${e.end_time ? `–${fmt12(e.end_time)}` : ""}`}
                        {e.location && ` · ${e.location}`}
                      </div>
                      {e.description && <p className="text-sm mt-1 text-foreground/80">{e.description}</p>}
                    </div>
                    {e.creator_id === user?.id && (
                      <button
                        onClick={async () => {
                          if (!confirm("এই ইভেন্টটি মুছে ফেলবেন?")) return;
                          const { error } = await supabase.from("events").delete().eq("id", e.id);
                          if (error) toast.error(error.message);
                        }}
                        className="text-xs text-destructive hover:underline"
                      >মুছুন</button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showCreate && (
        <CreateEventModal date={selected} onClose={() => setShowCreate(false)} />
      )}
    </div>
  );
}

function CreateEventModal({ date, onClose }: { date: string; onClose: () => void }) {
  const { user } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventDate, setEventDate] = useState(date);
  const [startTime, setStartTime] = useState("");
  const [endTime, setEndTime] = useState("");
  const [location, setLocation] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return toast.error("শিরোনাম দিতে হবে");
    setBusy(true);
    const { data: prof } = await supabase.from("profiles").select("full_name").eq("id", user!.id).maybeSingle();
    const { error } = await supabase.from("events").insert({
      creator_id: user!.id,
      creator_name: prof?.full_name ?? "",
      title: title.trim(),
      description: description.trim(),
      event_date: eventDate,
      start_time: startTime || null,
      end_time: endTime || null,
      location: location.trim(),
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("ইভেন্ট তৈরি হয়েছে");
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="bg-card rounded-2xl p-6 w-full max-w-md space-y-3 ring-soft">
        <h2 className="font-display text-xl">নতুন ইভেন্ট</h2>
        <input className="w-full px-3 py-2 rounded-lg border bg-background" placeholder="শিরোনাম" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <textarea className="w-full px-3 py-2 rounded-lg border bg-background" placeholder="বিবরণ (ঐচ্ছিক)" rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          <input type="date" className="px-3 py-2 rounded-lg border bg-background col-span-3" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required />
          <input type="time" className="px-3 py-2 rounded-lg border bg-background" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
          <input type="time" className="px-3 py-2 rounded-lg border bg-background" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
          <input className="px-3 py-2 rounded-lg border bg-background" placeholder="স্থান" value={location} onChange={(e) => setLocation(e.target.value)} />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-4 py-2 rounded-lg hover:bg-secondary">বাতিল</button>
          <button disabled={busy} className="btn-hero px-4 py-2 rounded-lg">{busy ? "সংরক্ষণ হচ্ছে…" : "তৈরি করুন"}</button>
        </div>
      </form>
    </div>
  );
}
