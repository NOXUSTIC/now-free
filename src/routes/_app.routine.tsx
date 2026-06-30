import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { parseRoutinePdf } from "@/lib/parse-routine.functions";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DAY_NAMES_BN, fmt12 } from "@/lib/dhaka-time";

export const Route = createFileRoute("/_app/routine")({
  component: RoutinePage,
});

type SlotRow = {
  id: string; day_of_week: number; start_time: string; end_time: string;
  course_code: string; section: string; room: string;
};

function computeFreeWindows(slots: SlotRow[]) {
  // For each day, find gaps between 08:00 and 20:00 that are not covered by any class.
  const DAY_START = "08:00:00";
  const DAY_END = "20:00:00";
  const result: { day: number; start: string; end: string }[] = [];
  for (let d = 0; d < 7; d++) {
    const todays = slots
      .filter((s) => s.day_of_week === d)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));
    if (todays.length === 0) continue;
    let cursor = DAY_START;
    for (const s of todays) {
      if (s.start_time > cursor) {
        result.push({ day: d, start: cursor, end: s.start_time });
      }
      if (s.end_time > cursor) cursor = s.end_time;
    }
    if (cursor < DAY_END) result.push({ day: d, start: cursor, end: DAY_END });
  }
  return result;
}

function RoutinePage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
  const [errorDetail, setErrorDetail] = useState<string>("");
  const [deleting, setDeleting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: slots = [] } = useQuery({
    queryKey: ["my-routine", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_slots")
        .select("*")
        .eq("user_id", user!.id)
        .order("day_of_week")
        .order("start_time");
      if (error) throw error;
      return data as SlotRow[];
    },
    enabled: !!user,
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) return toast.error("অনুগ্রহ করে একটি PDF ফাইল আপলোড করুন");
    if (f.size > 8 * 1024 * 1024) return toast.error("PDF ফাইলটি অনেক বড় (সর্বোচ্চ ৮ মেগাবাইট)");

    setBusy(true);
    setErrorDetail("");
    setProgress("ফাইল পড়া হচ্ছে…");
    try {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);

      setProgress("রুটিন বিশ্লেষণ করা হচ্ছে… (১০ থেকে ৩০ সেকেন্ড সময় লাগতে পারে)");
      const parsed = await parseRoutinePdf({ data: { pdfBase64: b64, filename: f.name } });

      setProgress("সংরক্ষণ করা হচ্ছে…");
      await supabase.from("routine_slots").delete().eq("user_id", user!.id);
      await supabase.from("exams").delete().eq("user_id", user!.id);

      if (parsed.slots.length) {
        const rows = parsed.slots.map((s) => ({ ...s, user_id: user!.id }));
        const { error } = await supabase.from("routine_slots").insert(rows);
        if (error) throw new Error(`ডাটাবেইজে সংরক্ষণ ব্যর্থ: ${error.message}`);
      }
      if (parsed.exams.length) {
        const rows = parsed.exams.map((e) => ({ ...e, user_id: user!.id }));
        const { error } = await supabase.from("exams").insert(rows);
        if (error) throw new Error(`পরীক্ষা সংরক্ষণ ব্যর্থ: ${error.message}`);
      }
      qc.invalidateQueries();
      toast.success(`${parsed.slots.length}টি ক্লাস ও ${parsed.exams.length}টি পরীক্ষা শনাক্ত করা হয়েছে।`);
      setProgress("");
    } catch (err) {
      console.error(err);
      const msg = err instanceof Error ? err.message : String(err);
      toast.error("রুটিন বিশ্লেষণ ব্যর্থ হয়েছে");
      setErrorDetail(msg);
      setProgress("");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleDeleteRoutine() {
    if (!user) return;
    const ok = window.confirm(
      "আপনি কি নিশ্চিত? আপনার রুটিন, সমস্ত ক্লাস এবং পরীক্ষার তথ্য স্থায়ীভাবে মুছে যাবে।",
    );
    if (!ok) return;
    setDeleting(true);
    try {
      const [r1, r2] = await Promise.all([
        supabase.from("routine_slots").delete().eq("user_id", user.id),
        supabase.from("exams").delete().eq("user_id", user.id),
      ]);
      if (r1.error) throw r1.error;
      if (r2.error) throw r2.error;
      qc.invalidateQueries();
      toast.success("রুটিন ও সংশ্লিষ্ট তথ্য মুছে ফেলা হয়েছে।");
      setErrorDetail("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "মুছে ফেলা যায়নি");
    } finally {
      setDeleting(false);
    }
  }

  function triggerPicker() {
    fileRef.current?.click();
  }

  const byDay = new Map<number, SlotRow[]>();
  for (const s of slots) {
    const arr = byDay.get(s.day_of_week) ?? [];
    arr.push(s);
    byDay.set(s.day_of_week, arr);
  }

  const hasRoutine = slots.length > 0;
  const freeWindows = useMemo(() => computeFreeWindows(slots), [slots]);
  const freeByDay = new Map<number, { start: string; end: string }[]>();
  for (const w of freeWindows) {
    const arr = freeByDay.get(w.day) ?? [];
    arr.push({ start: w.start, end: w.end });
    freeByDay.set(w.day, arr);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl">আপনার রুটিন</h1>
          <p className="mt-2 text-muted-foreground max-w-2xl">
            আপনার USIS রুটিনের PDF আপলোড করুন। প্রতিটি ক্লাস, পরীক্ষার তারিখ এবং ফ্রি পিরিয়ড স্বয়ংক্রিয়ভাবে শনাক্ত করা হবে।
            যেকোনো সময় নতুন PDF দিয়ে রুটিন পুনরায় আপলোড করতে পারবেন — পুরোনো রুটিন স্বয়ংক্রিয়ভাবে প্রতিস্থাপিত হবে।
          </p>
        </div>
        {hasRoutine && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={triggerPicker}
              disabled={busy || deleting}
              className="btn-hero px-4 py-2 rounded-xl text-sm whitespace-nowrap disabled:opacity-50"
            >
              {busy ? "প্রসেসিং…" : "রুটিন পুনরায় আপলোড করুন"}
            </button>
            <button
              onClick={handleDeleteRoutine}
              disabled={busy || deleting}
              className="px-4 py-2 rounded-xl text-sm whitespace-nowrap border border-destructive/40 text-destructive hover:bg-destructive/10 disabled:opacity-50"
            >
              {deleting ? "মুছে ফেলা হচ্ছে…" : "রুটিন স্থায়ীভাবে মুছে ফেলুন"}
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 rounded-2xl border-2 border-dashed p-8 text-center bg-card">
        <p className="font-medium">
          {hasRoutine ? "নতুন PDF দিয়ে রুটিন আপডেট করুন" : "আপনার রুটিনের PDF এখানে দিন"}
        </p>
        <p className="text-sm text-muted-foreground mt-1">শুধুমাত্র PDF, সর্বোচ্চ ৮ মেগাবাইট</p>
        <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFile} className="hidden" id="routine-file" />
        <label
          htmlFor="routine-file"
          className={`mt-4 inline-block btn-hero px-5 py-2.5 rounded-xl font-medium cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}
        >
          {busy ? "প্রসেসিং…" : hasRoutine ? "নতুন PDF নির্বাচন করুন" : "PDF নির্বাচন করুন"}
        </label>
        {progress && <p className="mt-3 text-sm text-primary">{progress}</p>}
      </div>

      {errorDetail && (
        <div className="mt-4 rounded-xl border border-destructive/40 bg-destructive/5 p-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-medium text-destructive">রুটিন বিশ্লেষণে সমস্যা হয়েছে</p>
              <p className="mt-1 text-sm text-foreground/80 whitespace-pre-wrap break-words">{errorDetail}</p>
              <p className="mt-2 text-xs text-muted-foreground">
                পরামর্শ: PDF টি যেন USIS থেকে সরাসরি ডাউনলোড করা হয়, পাসওয়ার্ড-সুরক্ষিত না হয়, এবং পাঠযোগ্য টেক্সট থাকে। স্ক্যান করা ছবি হলে তা OCR করে আবার চেষ্টা করুন।
              </p>
            </div>
            <button
              onClick={() => setErrorDetail("")}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              বন্ধ
            </button>
          </div>
        </div>
      )}

      {hasRoutine && (
        <>
          <div className="mt-8 flex items-center justify-between">
            <h2 className="font-display text-xl">বিশ্লেষণকৃত রুটিন · {slots.length}টি পিরিয়ড</h2>
            <button onClick={() => nav({ to: "/free" })} className="btn-hero px-5 py-2 rounded-xl">সম্পন্ন</button>
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => {
              const list = byDay.get(d) ?? [];
              const free = freeByDay.get(d) ?? [];
              if (list.length === 0) return null;
              return (
                <div key={d} className="bg-card border rounded-2xl p-4 ring-soft">
                  <div className="font-display font-semibold mb-2">{DAY_NAMES_BN[d]}বার</div>
                  <ul className="space-y-1">
                    {list.map((s) => (
                      <li key={s.id} className="flex justify-between text-sm py-1 border-t first:border-t-0">
                        <span>
                          <span className="font-medium">{s.course_code || "—"}</span>
                          {s.section ? <span className="text-muted-foreground"> · {s.section}</span> : null}
                          {s.room ? <span className="text-muted-foreground"> · {s.room}</span> : null}
                        </span>
                        <span className="tabular-nums text-foreground/70">{fmt12(s.start_time)}–{fmt12(s.end_time)}</span>
                      </li>
                    ))}
                  </ul>
                  {free.length > 0 && (
                    <div className="mt-3 pt-3 border-t">
                      <div className="text-xs font-medium text-muted-foreground mb-1">ফ্রি পিরিয়ড</div>
                      <ul className="space-y-0.5">
                        {free.map((w, i) => (
                          <li key={i} className="text-xs text-foreground/70 tabular-nums">
                            {fmt12(w.start)} – {fmt12(w.end)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
