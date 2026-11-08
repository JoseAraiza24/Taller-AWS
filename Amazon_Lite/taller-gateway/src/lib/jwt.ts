import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "local_secret";

export interface JWTPayload {
  userId: string;
  role: string;
}

export const verifyAccessToken = (token: string): JWTPayload => {
  const payload = jwt.verify(token, JWT_SECRET, { algorithms: ["HS256"] });
  if (
    typeof payload === "string" ||
    typeof payload.userId !== "string" ||
    !payload.userId ||
    typeof payload.role !== "string" ||
    !payload.role
  ) {
    throw new Error("Unauthorized");
  }
  return payload as JWTPayload;
};
