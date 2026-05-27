import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-page px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-bold text-fern">Roost</h1>
          <p className="mt-2 text-ink-light">
            Sign in to manage your trips
          </p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
