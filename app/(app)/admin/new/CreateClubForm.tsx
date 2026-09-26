"use client";

import { useActionState, useState } from "react";
import { StepIndicator } from "@/components/AuthShell";
import { FormMessage, SubmitButton } from "@/components/forms";
import { generateHandleBase } from "@/lib/roster/handle";
import { createClubAction, type ActionState } from "../actions";

export function CreateClubForm({ appUrl }: { appUrl: string }) {
  const [state, action] = useActionState<ActionState, FormData>(createClubAction, {});
  const [name, setName] = useState("");
  const handle = generateHandleBase(name || "Your club");
  const host = appUrl.replace(/^https?:\/\//, "");

  return (
    <form action={action} className="flex max-w-[920px] flex-col gap-6 px-4 py-8 sm:px-6">
      <div>
        <StepIndicator current={2} />
        <h1 className="font-[family-name:var(--kb-font-display)] text-[38px] font-bold leading-[1.05] lg:text-[52px]">Name your club</h1>
        <p className="kb-lead mt-3 !text-[17px]">Members see this name on every album. You can change it later.</p>
      </div>
      <div className="grid gap-6" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
        <div className="flex flex-col gap-4">
          <label className="field">
            Club name
            <input
              className="input"
              name="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="UQ Volleyball"
              required
              maxLength={120}
              autoFocus
            />
          </label>
          <label className="field">
            University
            <input className="input" name="organisation" placeholder="The University of Queensland" maxLength={160} />
          </label>
          <label className="field">
            Short description
            <textarea className="input" name="description" maxLength={1000} placeholder="Social and competitive volleyball since 1998." />
          </label>
        </div>
        <div className="flex flex-col gap-4">
          <span className="kb-label">Your club address</span>
          <div className="soft-card p-4">
            <div className="kb-caption">Members will see</div>
            <div className="mt-2 soft-display text-[22px] tracking-[-0.02em]">{name || "Your club"}</div>
            <div className="mt-1 break-all text-[14px] text-[color:var(--ink-70)]">
              {host}/c/<strong>{handle}</strong>
            </div>
          </div>
          <p className="text-[14px] leading-normal text-[color:var(--ink-70)]">
            The address is made from the club name. Once you upload photos it stays fixed, so links shared in group chats
            never break. If the address is taken we add a number to the end.
          </p>
        </div>
      </div>
      <FormMessage state={state} />
      <div className="flex flex-wrap gap-3">
        <SubmitButton className="btn btn-primary" pendingText="Creating…">
          Continue to activate
        </SubmitButton>
      </div>
    </form>
  );
}
