/** A nameless account can otherwise only sit on this screen. This is the way off it. */
export function NameStepSignOut() {
  return (
    <form action="/api/auth/signout" method="post" className="m-0 mt-8 text-center">
      <button type="submit" className="kb-link text-[15px]">
        Sign out
      </button>
    </form>
  );
}
