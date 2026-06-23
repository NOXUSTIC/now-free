import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const InputSchema = z.object({
  // base64-encoded PDF (no data: prefix)
  pdfBase64: z.string().min(100),
  filename: z.string().default("routine.pdf"),
});

// `.default()` in Zod only fires for `undefined`, not `null` — and Gemini
// frequently emits explicit `null` for fields it couldn't find in the PDF
// (e.g. a room not yet assigned). `.nullish()` + transform catches both.
const nullableString = () => z.string().nullish().transform((v) => v ?? "");

const SlotSchema = z.object({
  day_of_week: z.number().int().min(0).max(6),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  course_code: nullableString(),
  section: nullableString(),
  room: nullableString(),
});
const ExamSchema = z.object({
  course_code: z.string(),
  exam_type: z.enum(["mid", "final", "quiz", "other"]),
  exam_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).nullable().optional(),
  room: nullableString(),
});

export type ParsedRoutine = {
  slots: z.infer<typeof SlotSchema>[];
  exams: z.infer<typeof ExamSchema>[];
};

const SYSTEM_PROMPT = `You extract a BRAC University (BRACU) class routine from a PDF.

Return STRICT JSON only, no commentary, matching exactly:
{
  "slots": [
    {
      "day_of_week": 0,           // 0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat
      "start_time": "08:00",      // 24h HH:MM, Asia/Dhaka local
      "end_time":   "09:20",
      "course_code": "CSE220",
      "section": "01",
      "room": "UB40701"
    }
  ],
  "exams": [
    {
      "course_code": "CSE220",
      "exam_type": "mid",         // one of: mid, final, quiz, other
      "exam_date": "2026-07-15",  // ISO date
      "start_time": "09:30",
      "end_time": "11:00",
      "room": "UB40701"
    }
  ]
}

Rules:
- If a class meets on multiple days (e.g. "ST" = Sun+Tue), output one slot per day.
- BRACU day codes: S=Sun, M=Mon, T=Tue, W=Wed, R=Thu, F=Fri, A=Sat.
- Convert all times to 24-hour HH:MM (e.g. "11:00 AM"->"11:00", "2:00 PM"->"14:00").
- Skip empty cells and weekly off days.
- Include both midterm and final exams if listed. Use ISO 2026 dates when only month/day shown; otherwise pick the most reasonable year from the PDF semester context.
- If a field like room isn't printed or isn't known (e.g. exam room not yet assigned), use an empty string "" — never null.
- Return ONLY the JSON object, nothing else.`;

export const parseRoutinePdf = createServerFn({ method: "POST" })
  .inputValidator((d: unknown) => InputSchema.parse(d))
  .handler(async ({ data }): Promise<ParsedRoutine> => {
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("LOVABLE_API_KEY not configured");

    const body = {
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Parse this routine PDF and return JSON." },
            {
              type: "file",
              file: {
                filename: data.filename,
                file_data: `data:application/pdf;base64,${data.pdfBase64}`,
              },
            },
          ],
        },
      ],
    };

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text();
      console.error("AI gateway error", res.status, txt);
      throw new Error(`AI gateway error ${res.status}`);
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";

    // Strip code fences if present
    const cleaned = content
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/```\s*$/i, "")
      .trim();

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      // try to find first { ... last }
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start >= 0 && end > start) {
        parsed = JSON.parse(cleaned.slice(start, end + 1));
      } else {
        throw new Error("Model did not return valid JSON");
      }
    }

    const shape = z.object({
      slots: z.array(SlotSchema).default([]),
      exams: z.array(ExamSchema).default([]),
    });
    const out = shape.parse(parsed);

    // normalize HH:MM -> HH:MM:00
    const norm = (t: string) => (t.length === 5 ? `${t}:00` : t);
    return {
      slots: out.slots.map((s) => ({ ...s, start_time: norm(s.start_time), end_time: norm(s.end_time) })),
      exams: out.exams.map((e) => ({
        ...e,
        start_time: e.start_time ? norm(e.start_time) : null,
        end_time: e.end_time ? norm(e.end_time) : null,
      })),
    };
  });
