import { withCors } from "../common/cors";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import bcrypt from "bcryptjs";
import { v4 as uuidv4 } from "uuid";
import { dynamo } from "../lib/dynamodb";
import { ok, badRequest, serverError } from "../lib/response";
import type { User } from "../types/user";

async function registerHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  let body: Record<string, unknown>;
  try {
    const parsed: unknown = JSON.parse(event.body || "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return badRequest("El body debe ser un objeto JSON");
    body = parsed as Record<string, unknown>;
  } catch {
    return badRequest("El body debe contener JSON válido");
  }

  const { email, password, name, role = "buyer" } = body;
  if (typeof email !== "string" || !email.trim() || typeof password !== "string" || !password || typeof name !== "string" || !name.trim()) {
    return badRequest("email, password y name son requeridos para el registro");
  }
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return badRequest("El email no es válido");
  if (role !== "buyer" && role !== "seller") return badRequest("El role debe ser buyer o seller");

  try {
    const table = process.env.USERS_TABLE;
    if (!table) throw new Error("USERS_TABLE no está configurada");
    const existing = await dynamo.send(new QueryCommand({
      TableName: table,
      IndexName: "email-index",
      KeyConditionExpression: "email = :email",
      ExpressionAttributeValues: { ":email": normalizedEmail },
      Limit: 1,
    }));
    if (existing.Items?.length) return badRequest("El email ya se encuentra registrado");

    const hashPassword = await bcrypt.hash(password, 10);
    const now = new Date().toISOString();
    const user: User = {
      userId: uuidv4(),
      email: normalizedEmail,
      password: hashPassword,
      name: name.trim(),
      role,
      createdAt: now,
      updatedAt: now,
    };
    await dynamo.send(new PutCommand({
      TableName: table,
      Item: user,
      ConditionExpression: "attribute_not_exists(userId)",
    }));
    const { password: _password, ...userPublic } = user;
    return ok(userPublic);
  } catch (error) {
    console.error("Error al registrar el usuario", error instanceof Error ? error.name : "UnknownError");
    return serverError();
  }
}

export const register = withCors(registerHandler);
