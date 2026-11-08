import { withCors } from "../common/cors";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../lib/dynamodb";
import { notFound, ok, serverError, unauthorized } from "../lib/response";
import { authenticatedUserId } from "../lib/auth";
import { publicUser, usersTable } from "../lib/users";
import type { User } from "../types/user";

async function getUserHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!authenticatedUserId(event)) return unauthorized("Unauthorized");
  const userId = event.pathParameters?.id;
  if (!userId) return notFound("El id es requerido en el path");
  try {
    const result = await dynamo.send(new GetCommand({ TableName: usersTable(), Key: { userId }, ConsistentRead: true }));
    if (!result.Item) return notFound();
    return ok(publicUser(result.Item as User));
  } catch (error) {
    console.error("Error en getUser", error instanceof Error ? error.name : "UnknownError");
    return serverError("Error al consultar el usuario");
  }
}

export const getUser = withCors(getUserHandler);
