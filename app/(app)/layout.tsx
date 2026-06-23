import { BottomNav } from "@/components/bottom-nav";
import { Providers } from "@/components/providers";
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
    <Providers>
      <div className="min-h-screen bg-page pb-20">
        <main className="mx-auto w-full max-w-lg px-4 pt-6 sm:max-w-2xl sm:px-6 sm:pt-8 md:max-w-3xl">
          {children}
        </main>
        <BottomNav />
      </div>
    </Providers>
  );
}
