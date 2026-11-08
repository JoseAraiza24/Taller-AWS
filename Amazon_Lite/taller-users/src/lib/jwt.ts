import jwt from "jsonwebtoken";

export interface TokenPayload {
  userId: string;
  email: string;
  role: string;
}

const secret = (name: "JWT_SECRET" | "JWT_REFRESH_SECRET"): string => {
  const value = process.env[name];
  if (!value) throw new Error(`${name} no está configurado`);
  return value;
};

export const generateAccessToken = (payload: TokenPayload): string =>
  jwt.sign(payload, secret("JWT_SECRET"), { algorithm: "HS256", expiresIn: "1h" });

export const generateRefreshToken = (payload: TokenPayload): string =>
  jwt.sign(payload, secret("JWT_REFRESH_SECRET"), { algorithm: "HS256", expiresIn: "7d" });

export const verifyAccessToken = (token: string): TokenPayload =>
  jwt.verify(token, secret("JWT_SECRET"), { algorithms: ["HS256"] }) as TokenPayload;

export const verifyRefreshToken = (token: string): TokenPayload =>
  jwt.verify(token, secret("JWT_REFRESH_SECRET"), { algorithms: ["HS256"] }) as TokenPayload;
