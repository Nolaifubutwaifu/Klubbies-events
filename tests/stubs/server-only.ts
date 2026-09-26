// `server-only` throws on import outside a React Server Component, which is
// exactly what it is for — and exactly what stops vitest importing anything
// under lib/ that guards itself with it. Aliased to this empty module so the
// tests can reach real server code.
export {};
