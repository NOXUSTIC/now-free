import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { fmt12, nowInDhaka } from "@/lib/dhaka-time";

export const Route = createFileRoute("/_app/exams")({
  component: ExamsPage,
});

function ExamsPage() {
  const { user } = useAuth();
  const today = nowInDhaka().toISOString().slice(0, 10);

  const { data: exams = [] } = useQuery({
    queryKey: ["exams", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("exams")
        .select("*")
        .eq("user_id", user!.id)
        .order("exam_date")
        .order("start_time");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const upcoming = exams.filter((e) => e.exam_date >= today);
  const past = exams.filter((e) => e.exam_date < today);

  const mid = upcoming.filter((e) => e.exam_type === "mid");
  const final = upcoming.filter((e) => e.exam_type === "final");
  const other = upcoming.filter((e) => !["mid", "final"].includes(e.exam_type));

  return (
    <div className="max-w-4xl mx-auto px-4 md:px-6 py-8">
      <h1 className="font-display text-3xl">Upcoming exams</h1>
      <p className="mt-2 text-muted-foreground">Extracted from your uploaded routine.</p>

      {exams.length === 0 && (
        <div className="mt-6 bg-card border rounded-2xl p-8 text-center ring-soft">
          <p className="text-muted-foreground">No exams found yet.</p>
          <Link to="/routine" className="mt-3 inline-block text-primary text-sm hover:underline">Upload your routine →</Link>
        </div>
      )}

      <Section title="Midterms" rows={mid} />
      <Section title="Finals" rows={final} />
      {other.length > 0 && <Section title="Other" rows={other} />}
      {past.length > 0 && <Section title="Past" rows={past} muted />}
    </div>
  );
}

function Section({ title, rows, muted }: { title: string; rows: any[]; muted?: boolean }) {
  if (rows.length === 0) return null;
  return (
    <section className={`mt-8 ${muted ? "opacity-60" : ""}`}>
      <h2 className="font-display text-lg font-semibold mb-3">{title}</h2>
      <ul className="space-y-2">
        {rows.map((e) => (
          <li key={e.id} className="bg-card border rounded-xl p-4 ring-soft flex items-center gap-4">
            <div className="text-center w-16">
              <div className="text-xs text-muted-foreground uppercase">{new Date(e.exam_date).toLocaleString("en", { month: "short" })}</div>
              <div className="font-display text-2xl font-bold">{new Date(e.exam_date).getDate()}</div>
            </div>
            <div className="flex-1">
              <div className="font-medium">{e.course_code}</div>
              <div className="text-xs text-muted-foreground capitalize">
                {e.exam_type} exam
                {e.start_time ? ` · ${fmt12(e.start_time)}${e.end_time ? `–${fmt12(e.end_time)}` : ""}` : ""}
                {e.room ? ` · ${e.room}` : ""}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
