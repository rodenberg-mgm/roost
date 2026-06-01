import Image from "next/image";
import { LoginForm } from "./login-form";

export default function LoginPage() {
  return (
    <main className="topo-bg flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Logo + title */}
        <div className="animate-scale-in mb-8 flex flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt="Roost"
            width={80}
            height={80}
            className="h-18 w-18"
            priority
          />
          <h1 className="animate-fade-in delay-1 mt-3 font-display text-3xl font-bold uppercase tracking-tight text-forest">
            Roost
          </h1>
          <p className="animate-fade-in delay-2 mt-2 text-sm text-ink-light">
            Sign in to manage your trips
          </p>
        </div>

        {/* Login card */}
        <div className="animate-slide-up delay-3 rounded-card border bg-card p-6 shadow-card">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
