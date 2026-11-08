import { withCors } from "../common/cors";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../lib/dynamodb";
import { badRequest, notFound, ok, serverError, unauthorized } from "../lib/response";
import { authenticatedUserId } from "../lib/auth";
import { publicUser, usersTable } from "../lib/users";
import type { User } from "../types/user";

async function deleteUserHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const callerId = authenticatedUserId(event);
  if (!callerId) return unauthorized("Unauthorized");
  const userId = event.pathParameters?.id;
  if (!userId) return notFound();
  if (callerId !== userId) return badRequest("Solo puedes borrar a tu propio usuario");
  try {
    const result = await dynamo.send(new DeleteCommand({
      TableName: usersTable(), Key: { userId },
      ConditionExpression: "attribute_exists(userId)", ReturnValues: "ALL_OLD",
    }));
    return ok({ message: "Usuario borrado exitosamente", user: publicUser(result.Attributes as User) });
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") return notFound();
    console.error("Error en deleteUser", error instanceof Error ? error.name : "UnknownError");
    return serverError("Error al borrar el usuario");
  }
}

export const deleteUser = withCors(deleteUserHandler);
