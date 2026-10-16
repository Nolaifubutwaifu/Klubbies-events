import { AccountMenu } from "@/components/AccountMenu";
import { BackButton } from "@/components/BackButton";
import { Brand } from "@/components/ui";

/** The header for screens outside any one event: your events, your profile. */
export function SimpleHeader({ name, avatarUrl = null, back }: { name: string; avatarUrl?: string | null; back?: string }) {
  return (
    <header className="border-b border-[color:var(--kb-line)] bg-[color:var(--kb-white)]">
      <div className="mx-auto flex min-h-[60px] w-full max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6">
        <span className="flex min-w-0 items-center gap-1">
          {/* A screen you open from somewhere (your profile) starts with the way back. */}
          {back ? <BackButton fallback={back} /> : null}
          <Brand href="/events" />
        </span>
        <AccountMenu name={name} avatarUrl={avatarUrl} />
      </div>
    </header>
  );
}
