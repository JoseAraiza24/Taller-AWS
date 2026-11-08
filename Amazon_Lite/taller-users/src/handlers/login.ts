import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand, QueryCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
import { dynamo } from "../lib/dynamodb";
import { badRequest, ok, serverError, unauthorized } from "../lib/response";
import { generateAccessToken, generateRefreshToken } from "../lib/jwt";
import { parseBody, usersTable } from "../lib/users";
import type { User } from "../types/user";

export async function login(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const body = parseBody(event.body);
  if (!body) return badRequest("El body debe contener un objeto JSON válido");
  const { email, password } = body;
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password) {
    return badRequest("email y password son requeridos");
  }
  try {
    const result = await dynamo.send(new QueryCommand({
      TableName: usersTable(), IndexName: "email-index",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": email.trim().toLowerCase() }, Limit: 1,
    }));
    const user = result.Items?.[0] as User | undefined;
    if (!user || !(await bcrypt.compare(password, user.password))) return unauthorized();
    const payload = { userId: user.userId, email: user.email, role: user.role };
    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);
    const table = process.env.REFRESH_TOKENS_TABLE;
    if (!table) throw new Error("REFRESH_TOKENS_TABLE no está configurada");
    await dynamo.send(new PutCommand({
      TableName: table,
      Item: { token: refreshToken, userId: user.userId, expiresAt: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 },
    }));
    return ok({ accessToken, refreshToken });
  } catch (error) {
    console.error("Error en login", error instanceof Error ? error.name : "UnknownError");
    return serverError("Error al iniciar sesión");
  }
}
