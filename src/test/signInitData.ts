import crypto from "node:crypto";

export function signInitData(
  token: string,
  fields: Record<string, string>,
  hashOverride?: string,
): string {
  const secret = crypto.createHmac("sha256", "WebAppData").update(token).digest();
  const dataCheckString = Object.keys(fields)
    .sort()
    .map((key) => `${key}=${fields[key]}`)
    .join("\n");
  const hash =
    hashOverride ?? crypto.createHmac("sha256", secret).update(dataCheckString).digest("hex");
  return new URLSearchParams({ ...fields, hash }).toString();
}
