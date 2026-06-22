import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { supabase } from "@/integrations/supabase/client";
import { DAY_NAMES_BN, dhakaDayIndex, fmt12, nowInDhaka } from "@/lib/dhaka-time";

export const Route = createFileRoute("/_app/home")({
  component: HomePage,
});

function HomePage() {
  const { user } = useAuth();
  const today = dhakaDayIndex();
  const todayStr = nowInDhaka().toISOString().slice(0, 10);

  const { data: slots = [] } = useQuery({
    queryKey: ["my-slots", user?.id, today],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("routine_slots")
        .select("*")
        .eq("user_id", user!.id)
        .eq("day_of_week", today)
        .order("start_time");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: profile } = useQuery({
    queryKey: ["me", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("full_name,email").eq("id", user!.id).maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const { data: nextExam } = useQuery({
    queryKey: ["next-exam", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("exams")
        .select("*")
        .eq("user_id", user!.id)
        .gte("exam_date", todayStr)
        .order("exam_date")
        .limit(1)
        .maybeSingle();
      return data;
    },
    enabled: !!user,
  });

  const firstName = (profile?.full_name || "there").split(" ")[0];

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-8">
      <h1 className="font-display text-3xl md:text-4xl">
        স্বাগতম, <span className="text-primary">{firstName}</span> 👋
      </h1>
      <p className="mt-2 text-muted-foreground">Today is {DAY_NAMES_BN[today]} · {nowInDhaka().toDateString().slice(4)}</p>

      <div className="mt-8 grid md:grid-cols-3 gap-5">
        <Card title="Today's classes" badge={`${slots.length}`}>
          {slots.length === 0 ? (
            <Empty msg="No classes today (or you haven't uploaded your routine)." cta={{ to: "/routine", label: "Upload routine" }} />
          ) : (
            <ul className="space-y-2">
              {slots.map((s) => (
                <li key={s.id} className="flex justify-between gap-3 py-2 border-t first:border-t-0">
                  <div>
                    <div className="font-medium">{s.course_code || "Class"}</div>
                    <div className="text-xs text-muted-foreground">{s.room || "—"}</div>
                  </div>
                  <div className="text-sm tabular-nums text-foreground/80">{fmt12(s.start_time)} – {fmt12(s.end_time)}</div>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="এখন কে ফ্রি??" accent>
          <p className="text-sm text-foreground/70">Tap the button to see classmates who are free right now.</p>
          <Link to="/free" className="btn-hero inline-flex mt-4 px-5 py-2.5 rounded-xl font-medium">
            See free students →
          </Link>
        </Card>

        <Card title="Next exam">
          {nextExam ? (
            <div>
              <div className="font-display text-lg">{nextExam.course_code}</div>
              <div className="text-sm text-muted-foreground capitalize">{nextExam.exam_type} exam</div>
              <div className="mt-2 text-2xl font-display">{nextExam.exam_date}</div>
              <div className="text-xs text-muted-foreground">
                {nextExam.start_time ? `${fmt12(nextExam.start_time)} – ${fmt12(nextExam.end_time || "")}` : "Time TBD"}
                {nextExam.room ? ` · ${nextExam.room}` : ""}
              </div>
              <Link to="/exams" className="mt-3 inline-block text-sm text-primary hover:underline">View all →</Link>
            </div>
          ) : (
            <Empty msg="No upcoming exams parsed yet." cta={{ to: "/routine", label: "Upload routine" }} />
          )}
        </Card>
      </div>
    </div>
  );
}

function Card({ title, badge, children, accent }: { title: string; badge?: string; children: React.ReactNode; accent?: boolean }) {
  return (
    <div className={`rounded-2xl border p-5 ring-soft ${accent ? "surface-mint" : "bg-card"}`}>
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display font-semibold">{title}</h2>
        {badge && <span className="text-xs px-2 py-0.5 rounded-full bg-primary text-primary-foreground">{badge}</span>}
      </div>
      {children}
    </div>
  );
}

function Empty({ msg, cta }: { msg: string; cta?: { to: string; label: string } }) {
  return (
    <div className="text-sm text-muted-foreground">
      {msg}
      {cta && (
        <div className="mt-3">
          <Link to={cta.to} className="text-primary hover:underline text-sm">{cta.label} →</Link>
        </div>
      )}
    </div>
  );
}
