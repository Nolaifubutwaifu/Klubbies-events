import { AccountMenu } from "@/components/AccountMenu";
import { Brand } from "@/components/ui";

/** The header for screens outside any one event: your events, your profile. */
export function SimpleHeader({ name, avatarUrl = null }: { name: string; avatarUrl?: string | null }) {
  return (
    <header className="border-b border-[color:var(--kb-line)] bg-[color:var(--kb-white)]">
      <div className="mx-auto flex min-h-[60px] w-full max-w-[1320px] items-center justify-between gap-4 px-4 sm:px-6">
        <Brand href="/events" />
        <AccountMenu name={name} avatarUrl={avatarUrl} />
      </div>
    </header>
  );
}
