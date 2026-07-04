import { z } from "zod";

/* apps/web only (D-16/XC-02) — never packages/core. zod v4's error param is
   `{ error: "..." }`, not v3's `{ message }`. `level` is deliberately NOT a
   key here: the DB column-grant freeze (0007) is the load-bearing layer,
   this is defense-in-depth at the validation layer (Pitfall 3). */
export const editProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, { error: "Add a name so your coach knows who they're talking to." }),
  goal: z.string().trim().max(2000).optional().default(""),
  locale: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
});

export type EditProfileInput = z.infer<typeof editProfileSchema>;
