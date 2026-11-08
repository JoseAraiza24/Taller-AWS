import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../lib/dynamodb";
import { badRequest, notFound, ok, serverError, unauthorized } from "../lib/response";
import { authenticatedUserId } from "../lib/auth";
import { parseBody, publicUser, usersTable } from "../lib/users";
import type { User } from "../types/user";

export async function updateUser(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const callerId = authenticatedUserId(event);
  if (!callerId) return unauthorized("Unauthorized");
  const userId = event.pathParameters?.id;
  if (!userId) return notFound();
  if (callerId !== userId) return badRequest("Solo puedes actualizar a tu propio usuario");
  const body = parseBody(event.body);
  if (!body) return badRequest("El body debe contener un objeto JSON válido");
  if (typeof body.name !== "string" || !body.name.trim()) return badRequest("El nombre es requerido");
  try {
    const result = await dynamo.send(new UpdateCommand({
      TableName: usersTable(), Key: { userId },
      UpdateExpression: "SET #name = :name, updatedAt = :updatedAt",
      ExpressionAttributeNames: { "#name": "name" },
      ExpressionAttributeValues: { ":name": body.name.trim(), ":updatedAt": new Date().toISOString() },
      ConditionExpression: "attribute_exists(userId)", ReturnValues: "ALL_NEW",
    }));
    return ok({ message: "Usuario actualizado exitosamente", user: publicUser(result.Attributes as User) });
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") return notFound();
    console.error("Error en updateUser", error instanceof Error ? error.name : "UnknownError");
    return serverError("Error al actualizar el usuario");
  }
}
