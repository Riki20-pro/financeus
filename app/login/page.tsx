import { createClient } from "@supabase/supabase-js";
import { redirect } from "next/navigation";
import { LoginForm } from "./login-form";

export default async function LoginPage() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );

  const { data } = await supabase.auth.getSession();

  if (data.session) {
    return redirect("/");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-900">
      <LoginForm />
    </div>
  );
}
