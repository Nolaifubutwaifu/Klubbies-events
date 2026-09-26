"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useTransition } from "react";
import { FormMessage, SubmitButton } from "@/components/forms";
import type { FeedPost } from "@/lib/feed/queries";
import { formatDateTime, plural } from "@/lib/format";
import { createPostAction, deletePostAction, togglePinAction, toggleReactionAction, type FeedResult } from "./actions";

export function Composer({
  handle,
  albums,
  memberCount,
}: {
  handle: string;
  albums: { id: string; title: string }[];
  memberCount: number;
}) {
  const [state, action] = useActionState<FeedResult, FormData>(createPostAction.bind(null, handle), {});
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  return (
    <form ref={form} action={action} className="flex flex-col gap-3 border-2 border-divider p-4">
      <textarea className="input" name="body" rows={2} placeholder="Tell the club something…" maxLength={4000} required />
      <div className="flex flex-wrap items-center gap-2">
        <label className="field flex-1 md:max-w-[280px]">
          <span className="sr-only">Link an album</span>
          <select className="input text-[14px]" name="albumId" defaultValue="">
            <option value="">No album linked</option>
            {albums.map((album) => (
              <option key={album.id} value={album.id}>
                {album.title}
              </option>
            ))}
          </select>
        </label>
        <SubmitButton className="btn btn-primary ml-auto text-[14px]" pendingText="Posting…">
          Post to {plural(memberCount, "member")}
        </SubmitButton>
      </div>
      <FormMessage state={state} />
    </form>
  );
}

export function PostList({ handle, posts, canPin }: { handle: string; posts: FeedPost[]; canPin: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<FeedResult>) =>
    startTransition(async () => {
      const res = await fn();
      if (res.ok) router.refresh();
    });

  return (
    <div className="flex flex-col">
      {posts.map((post) => (
        <article key={post.id} className="flex flex-col gap-3 border-t-2 border-divider px-6 py-6">
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex h-[34px] w-[34px] items-center justify-center bg-neutral-900 text-[14px] font-extrabold text-white">
              {post.authorInitials}
            </span>
            <span className="text-[14px] font-semibold">{post.authorName}</span>
            {post.authorRole ? <span className="tag tag-accent text-[14px]">{post.authorRole}</span> : null}
            <span className="text-[14px] text-ink-55">{formatDateTime(post.createdAt)}</span>
            {post.pinned ? <span className="tag tag-outline text-[14px]">Pinned</span> : null}
            <span className="ml-auto flex gap-2">
              {canPin ? (
                <button
                  type="button"
                  className="btn btn-ghost text-[14px]"
                  disabled={pending}
                  onClick={() => run(() => togglePinAction(handle, post.id, !post.pinned))}
                >
                  {post.pinned ? "Unpin" : "Pin"}
                </button>
              ) : null}
              {post.canDelete ? (
                <button
                  type="button"
                  className="btn btn-ghost text-[14px]"
                  disabled={pending}
                  onClick={() => run(() => deletePostAction(handle, post.id))}
                >
                  Delete
                </button>
              ) : null}
            </span>
          </div>

          <p className="max-w-[62ch] whitespace-pre-wrap text-[16px] leading-normal">{post.body}</p>

          {post.album ? (
            <Link
              href={`/c/${handle}/a/${post.album.id}`}
              className="flex items-center gap-3 border-2 border-divider p-3 text-ink no-underline hover:border-accent"
            >
              {post.album.coverUrl ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img src={post.album.coverUrl} alt="" className="h-11 w-11 object-cover" />
              ) : (
                <span className="h-11 w-11 bg-neutral-400" />
              )}
              <span>
                <span className="block font-heading text-[15px] font-bold">{post.album.title}</span>
                <span className="block text-[14px] text-ink-70">{post.album.meta}</span>
              </span>
            </Link>
          ) : null}

          <div className="flex flex-wrap items-center gap-2 pt-1">
            {post.reactions.map((reaction) => (
              <button
                key={reaction.emoji}
                type="button"
                className="border-2 px-[10px] py-[6px] text-[14px] font-semibold"
                style={{
                  borderColor: reaction.mine ? "var(--color-accent)" : "var(--color-divider)",
                  background: reaction.mine ? "var(--color-accent-100)" : "transparent",
                }}
                disabled={pending}
                onClick={() => run(() => toggleReactionAction(handle, post.id, reaction.emoji))}
              >
                {reaction.emoji} {reaction.count || ""}
              </button>
            ))}
          </div>

        </article>
      ))}
    </div>
  );
}
