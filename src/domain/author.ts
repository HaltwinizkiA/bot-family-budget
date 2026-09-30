export function createdBy(user: { id: number; username?: string | null }): string {
  const name = (user.username ?? "").replace(/^@/, "").trim();
  if (name) return name;
  return `id:${user.id}`;
}
