import type { User, PublicUser } from "../types/user";

export const usersTable = (): string => {
  if (!process.env.USERS_TABLE) throw new Error("USERS_TABLE no está configurada");
  return process.env.USERS_TABLE;
};

export const publicUser = (user: User): PublicUser => {
  const { password: _password, ...result } = user;
  return result;
};

export const parseBody = (body: string | null): Record<string, unknown> | null => {
  try {
    const value: unknown = JSON.parse(body || "{}");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
};
