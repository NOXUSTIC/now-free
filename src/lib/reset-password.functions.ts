import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  email: z.string().email().refine((e) => e.toLowerCase().endsWith("@g.bracu.ac.bd"), {
    message: "শুধু @g.bracu.ac.bd ইমেইল",
  }),
  password: z.string().min(6),
});

export const resetPasswordDirect = createServerFn({ method: "POST" })
  .inputValidator((data) => schema.parse(data))
  .handler(async ({ data }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const email = data.email.toLowerCase();

    // Find user by email via admin listUsers (paginate until found)
    let userId: string | null = null;
    let page = 1;
    while (page <= 20 && !userId) {
      const { data: list, error } = await supabaseAdmin.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const found = list.users.find((u) => u.email?.toLowerCase() === email);
      if (found) userId = found.id;
      if (list.users.length < 200) break;
      page++;
    }
    if (!userId) throw new Error("এই ইমেইলে কোনো অ্যাকাউন্ট নেই");

    const { error: updErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      password: data.password,
      email_confirm: true,
    });
    if (updErr) throw new Error(updErr.message);
    return { ok: true };
  });
