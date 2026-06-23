import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { parseRoutinePdf } from "@/lib/parse-routine.functions";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DAY_NAMES_BN, fmt12 } from "@/lib/dhaka-time";

export const Route = createFileRoute("/_app/routine")({
  component: RoutinePage,
});

function RoutinePage() {
  const { user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<string>("");
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
      return data;
    },
    enabled: !!user,
  });

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.toLowerCase().endsWith(".pdf")) return toast.error("দয়া করে একটি PDF ফাইল আপলোড করো");
    if (f.size > 8 * 1024 * 1024) return toast.error("PDF অনেক বড় (সর্বোচ্চ ৮MB)");

    setBusy(true);
    setProgress("ফাইল পড়া হচ্ছে…");
    try {
      const buf = await f.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = "";
      for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
      const b64 = btoa(bin);

      setProgress("AI দিয়ে রুটিন স্ক্যান হচ্ছে… (১০-৩০ সেকেন্ড লাগতে পারে)");
      const parsed = await parseRoutinePdf({ data: { pdfBase64: b64, filename: f.name } });

      setProgress("সেভ হচ্ছে…");
      await supabase.from("routine_slots").delete().eq("user_id", user!.id);
      await supabase.from("exams").delete().eq("user_id", user!.id);

      if (parsed.slots.length) {
        const rows = parsed.slots.map((s) => ({ ...s, user_id: user!.id }));
        const { error } = await supabase.from("routine_slots").insert(rows);
        if (error) throw error;
      }
      if (parsed.exams.length) {
        const rows = parsed.exams.map((e) => ({ ...e, user_id: user!.id }));
        const { error } = await supabase.from("exams").insert(rows);
        if (error) throw error;
      }
      qc.invalidateQueries();
      toast.success(`${parsed.slots.length}টি ক্লাস ও ${parsed.exams.length}টি পরীক্ষা পাওয়া গেছে।`);
      setProgress("");
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : "রুটিন পার্স করা যায়নি");
      setProgress("");
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const byDay = new Map<number, typeof slots>();
  for (const s of slots) {
    const arr = byDay.get(s.day_of_week) ?? [];
    arr.push(s);
    byDay.set(s.day_of_week, arr);
  }

  const hasRoutine = slots.length > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 md:px-6 py-8">
      <h1 className="font-display text-3xl">তোমার রুটিন</h1>
      <p className="mt-2 text-muted-foreground">
        তোমার USIS রুটিন PDF আপলোড করো। আমরা প্রতিটি ক্লাস ও পরীক্ষার তারিখ স্বয়ংক্রিয়ভাবে বের করে নেব।
        চাইলে যেকোনো সময় নতুন PDF দিয়ে আবার আপলোড করতে পারো — পুরোনো রুটিন রিপ্লেস হয়ে যাবে।
      </p>

      <div className="mt-6 rounded-2xl border-2 border-dashed p-8 text-center bg-card">
        <div className="text-5xl">📄</div>
        <p className="mt-3 font-medium">
          {hasRoutine ? "নতুন PDF দিয়ে রুটিন আপডেট করো" : "তোমার রুটিন PDF এখানে দাও"}
        </p>
        <p className="text-sm text-muted-foreground">শুধু PDF, সর্বোচ্চ ৮MB</p>
        <input ref={fileRef} type="file" accept="application/pdf" onChange={handleFile} className="hidden" id="routine-file" />
        <label
          htmlFor="routine-file"
          className={`mt-4 inline-block btn-hero px-5 py-2.5 rounded-xl font-medium cursor-pointer ${busy ? "opacity-50 pointer-events-none" : ""}`}
        >
          {busy ? "প্রসেসিং…" : hasRoutine ? "নতুন PDF বেছে নাও" : "PDF বেছে নাও"}
        </label>
        {progress && <p className="mt-3 text-sm text-primary">{progress}</p>}
      </div>

      {hasRoutine && (
        <>
          <div className="mt-8 flex items-center justify-between">
            <h2 className="font-display text-xl">পার্স করা রুটিন · {slots.length}টি পিরিয়ড</h2>
            <button onClick={() => nav({ to: "/free" })} className="btn-hero px-5 py-2 rounded-xl">শেষ →</button>
          </div>
          <div className="mt-4 grid md:grid-cols-2 gap-4">
            {[0, 1, 2, 3, 4, 5, 6].map((d) => {
              const list = byDay.get(d) ?? [];
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
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
