import type { APIGatewayProxyEvent } from "aws-lambda";
import jwt from "jsonwebtoken";

export interface Caller { userId: string; role: string }

export const authenticatedCaller = (event: APIGatewayProxyEvent): Caller | null => {
  if (process.env.STAGE === "local") {
    const header = event.headers?.Authorization || event.headers?.authorization;
    const secret = process.env.JWT_SECRET;
    if (!header || !secret) return null;
    try {
      const payload = jwt.verify(header.replace(/^Bearer\s+/i, ""), secret, { algorithms: ["HS256"] });
      if (typeof payload === "string" || typeof payload.userId !== "string" || !payload.userId || typeof payload.role !== "string") return null;
      return { userId: payload.userId, role: payload.role };
    } catch { return null; }
  }
  const context = event.requestContext.authorizer;
  return typeof context?.userId === "string" && context.userId && typeof context.role === "string"
    ? { userId: context.userId, role: context.role } : null;
};
