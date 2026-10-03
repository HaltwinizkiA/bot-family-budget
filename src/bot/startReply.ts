export function startReply(
  fromId: number | undefined,
  allowedUserIds: ReadonlySet<number>,
  link: string,
): string | undefined {
  if (fromId === undefined || !allowedUserIds.has(fromId)) return undefined;
  return `Семейный бюджет\n${link}`;
}
