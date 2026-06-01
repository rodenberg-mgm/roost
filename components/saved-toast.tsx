"use client";

import { CheckCircle2 } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Brief "Trip saved" confirmation, shown when a page is reached with ?saved=1.
 * Auto-dismisses after ~3s and strips the param from the URL.
 * Render inside <Suspense> (it reads useSearchParams).
 */
export function SavedToast() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!params.get("saved")) return;
    setShow(true);
    const hide = setTimeout(() => setShow(false), 2600);
    const clean = setTimeout(() => router.replace(pathname, { scroll: false }), 3000);
    return () => {
      clearTimeout(hide);
      clearTimeout(clean);
    };
  }, [params, pathname, router]);

  if (!show) return null;

  return (
    <div
      className="animate-slide-up fixed inset-x-0 top-4 z-[100] flex justify-center px-4"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center gap-2 rounded-button bg-forest px-4 py-2.5 text-sm font-medium text-bone-light shadow-button">
        <CheckCircle2 className="h-4 w-4" />
        Trip saved
      </div>
    </div>
  );
}
