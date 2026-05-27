import { createClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div>
      <header className="mb-6">
        <h1 className="font-display text-2xl font-bold text-ink">Settings</h1>
      </header>
      <div className="rounded-card bg-card p-4 shadow-card">
        <p className="text-sm text-ink-light">
          Signed in as <strong>{user?.email}</strong>
        </p>
      </div>
    </div>
  );
}
