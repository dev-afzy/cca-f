import { signOut } from "@/lib/auth";

export default function SignOutButton({ className }: { className?: string }) {
  return (
    <form action={async () => { "use server"; await signOut({ redirectTo: "/login" }); }}>
      <button type="submit" className={className ?? "text-xs text-stone-400 hover:underline"}>
        Sign out
      </button>
    </form>
  );
}
