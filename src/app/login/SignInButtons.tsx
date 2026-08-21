import { signIn } from "@/lib/auth";

export default function SignInButtons() {
  return (
    <div className="flex flex-col gap-3 w-full max-w-xs">
      <form action={async () => { "use server"; await signIn("github", { redirectTo: "/" }); }}>
        <button type="submit" className="w-full px-6 py-3 rounded-lg bg-stone-900 dark:bg-stone-100 text-stone-50 dark:text-stone-900 font-medium text-sm hover:opacity-90 transition">
          Continue with GitHub
        </button>
      </form>
      <form action={async () => { "use server"; await signIn("google", { redirectTo: "/" }); }}>
        <button type="submit" className="w-full px-6 py-3 rounded-lg border border-stone-300 dark:border-stone-700 text-stone-700 dark:text-stone-200 font-medium text-sm hover:bg-stone-100 dark:hover:bg-stone-800 transition">
          Continue with Google
        </button>
      </form>
    </div>
  );
}
