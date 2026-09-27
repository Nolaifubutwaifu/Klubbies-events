/** Where people reach us. Set SUPPORT_EMAIL; without it, pages fall back to other wording. */
export function supportEmail(): string | null {
  const value = process.env.SUPPORT_EMAIL?.trim();
  return value ? value : null;
}
