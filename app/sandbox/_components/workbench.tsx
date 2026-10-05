"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ViewTransition,
  startTransition,
  type ReactNode,
} from "react";

import { SiteNav } from "@/app/_components/site-nav";
import { ExchangeView } from "@/app/sandbox/_components/exchange-view";
import { NetworkDock } from "@/app/sandbox/_components/network-dock";
import { ResetDialog } from "@/app/sandbox/_components/reset-dialog";
import { Button } from "@/components/ui/button";
import { send, signIn, switchPersona } from "@/app/sandbox/_lib/api";
import { useExchanges } from "@/app/sandbox/_lib/exchange-store";
import { DEFAULT_PERSONA, PEOPLE } from "@/app/sandbox/_lib/people";
import { session, useSession } from "@/app/sandbox/_lib/session";
import { cn } from "@/lib/utils";

const TABS = [
  ["/sandbox/console", "Console"],
  ["/sandbox/app", "App"],
  ["/sandbox/data", "Data"],
  ["/sandbox/checks", "Brief checks"],
] as const;

const PERSONA_ORDER = [
  "reyes",
  "alvarez",
  "chen",
  "okafor",
  "maya",
  "jon",
  "priya",
  "theo",
] as const;

type RequestReset = (note?: string) => Promise<boolean>;
const ResetContext = createContext<RequestReset>(async () => false);
export const useRequestReset = () => useContext(ResetContext);

export function Workbench({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { active } = useSession();
  const { exchanges } = useExchanges();
  const [inspecting, setInspecting] = useState(false);
  const [reset, setReset] = useState<{ note: string | null } | null>(null);
  const [resetting, setResetting] = useState(false);
  const settle = useRef<((confirmed: boolean) => void) | null>(null);

  useEffect(() => {
    const requested = PEOPLE.find(
      (person) =>
        person.username ===
        new URLSearchParams(window.location.search).get("as"),
    );
    if (requested) {
      void switchPersona(requested.username);
    } else if (!session.get().active) void switchPersona(DEFAULT_PERSONA);
  }, []);

  const last = exchanges.at(-1);
  const lastWriteId = useRef<number | null>(null);
  useEffect(() => {
    if (!last || last.id === lastWriteId.current) return;
    if (
      last.method !== "GET" &&
      last.status < 400 &&
      !last.path.startsWith("/api/auth")
    ) {
      lastWriteId.current = last.id;
      router.refresh();
    }
  }, [last, router]);

  const requestReset = useCallback<RequestReset>((note) => {
    return new Promise<boolean>((resolve) => {
      settle.current = resolve;
      setReset({ note: note ?? null });
    });
  }, []);

  async function confirmReset() {
    setResetting(true);
    const persona = session.get().active ?? DEFAULT_PERSONA;
    const exchange = await send({
      method: "POST",
      path: "/sandbox/api/reset",
      auth: "none",
      label: "dev",
    });
    session.clearTokens();
    if (exchange.status === 200) await signIn(persona);
    router.refresh();
    setResetting(false);
    setReset(null);
    settle.current?.(exchange.status === 200);
  }

  function cancelReset() {
    setReset(null);
    settle.current?.(false);
  }

  return (
    <ResetContext.Provider value={requestReset}>
      <div className="bg-background text-foreground flex min-h-dvh flex-col font-(family-name:--font-app) text-[12.5px] leading-normal md:h-dvh">
        <header className="bg-card flex flex-wrap items-center gap-x-5 gap-y-2 border-b px-4 py-2.5">
          <SiteNav section="sandbox" sandbox />
          <div className="ml-auto flex flex-wrap items-center gap-1.5">
            <span className="text-muted-foreground mr-1 text-[11px] tracking-wider uppercase">
              Sign in as
            </span>
            {PERSONA_ORDER.map((username) => {
              const person = PEOPLE.find((p) => p.username === username);
              return (
                <button
                  key={username}
                  type="button"
                  aria-pressed={active === username}
                  onClick={() => void switchPersona(username, true)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5",
                    active === username
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background hover:border-ring",
                  )}
                >
                  {username}
                  <i className="text-[10px] opacity-70 not-italic">
                    {person?.role === "administrator" ? "admin" : person?.role}
                  </i>
                </button>
              );
            })}
          </div>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void requestReset()}
          >
            Reset sandbox data
          </Button>
        </header>
        <nav className="bg-card flex gap-0.5 overflow-x-auto border-b px-3">
          {TABS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={pathname.startsWith(href) ? "page" : undefined}
              className={cn(
                "relative px-3 py-2 whitespace-nowrap",
                pathname.startsWith(href)
                  ? "font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {label}
              {pathname.startsWith(href) && (
                <ViewTransition name="sandbox-tab-indicator" default="none">
                  <span className="bg-primary absolute inset-x-0 bottom-0 h-0.5" />
                </ViewTransition>
              )}
            </Link>
          ))}
        </nav>
        <main className="flex min-h-0 flex-1 flex-col">
          <ViewTransition
            key={pathname}
            default="none"
            enter="sandbox-fade-in"
            exit="sandbox-fade-out"
          >
            <div className="flex min-h-0 flex-1 flex-col">{children}</div>
          </ViewTransition>
        </main>
        <NetworkDock
          onInspect={() => startTransition(() => setInspecting(true))}
        />
      </div>
      <InspectDrawer
        open={inspecting}
        onClose={() => startTransition(() => setInspecting(false))}
      />
      <ResetDialog
        open={reset !== null}
        busy={resetting}
        note={reset?.note ?? null}
        onConfirm={() => void confirmReset()}
        onCancel={cancelReset}
      />
    </ResetContext.Provider>
  );
}

function InspectDrawer({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { exchanges, selectedId } = useExchanges();
  const exchange = exchanges.find((item) => item.id === selectedId) ?? null;
  if (!open) return null;
  return (
    <ViewTransition
      enter="sandbox-slide-in"
      exit="sandbox-slide-out"
      default="none"
    >
      <aside className="bg-card fixed inset-y-0 right-0 z-20 flex w-[min(34rem,100%)] flex-col border-l font-(family-name:--font-app) text-[12.5px] shadow-2xl">
        <div className="flex items-center gap-2.5 border-b px-4 py-2.5">
          <b className="flex-1">
            {exchange
              ? `#${exchange.id} ${exchange.method} ${exchange.status}`
              : "Request"}
          </b>
          <Button size="xs" variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
        <ExchangeView key={exchange?.id ?? 0} exchange={exchange} />
      </aside>
    </ViewTransition>
  );
}
