import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="topo-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-bold uppercase text-forest">Roost</h1>
          <p className="mt-2 text-ink-light">
            Sign in to manage your trips
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
