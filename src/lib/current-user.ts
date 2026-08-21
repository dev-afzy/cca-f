import "server-only";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { ensureStudent } from "@/lib/ensure-student";

export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  await ensureStudent(session.user.id);
  return session.user.id;
}

export async function requireUserIdApi(): Promise<string | null> {
  const session = await auth();
  const id = session?.user?.id ?? null;
  if (id) await ensureStudent(id);
  return id;
}
