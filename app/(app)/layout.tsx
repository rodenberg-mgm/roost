import { BottomNav } from "@/components/bottom-nav";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-page pb-20">
      <main className="mx-auto max-w-lg px-4 pt-6">{children}</main>
      <BottomNav />
    </div>
  );
}
