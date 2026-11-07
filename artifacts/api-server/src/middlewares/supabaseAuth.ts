import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { RequestHandler } from "express";

let client: SupabaseClient | undefined;

function getAuthClient(): SupabaseClient {
  const url = process.env.VITE_SUPABASE_URL?.trim();
  const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim();
  if (!url || !key) throw new Error("Supabase Auth configuration is missing.");
  client ??= createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}

export const requireSupabaseAuth: RequestHandler = async (req, res, next): Promise<void> => {
  const token = req.get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  if (!process.env.VITE_SUPABASE_URL || !process.env.VITE_SUPABASE_PUBLISHABLE_KEY) {
    req.log.error("Supabase Auth is not configured.");
    res.status(503).json({ error: "Authentication is not configured." });
    return;
  }
  try {
    const { data, error } = await getAuthClient().auth.getUser(token);
    if (error || !data.user) {
      res.status(401).json({ error: "Invalid or expired session" });
      return;
    }
    res.locals.authUserId = data.user.id;
    next();
  } catch {
    req.log.warn("Supabase session validation failed.");
    res.status(401).json({ error: "Invalid or expired session" });
  }
};
