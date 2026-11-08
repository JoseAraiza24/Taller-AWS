import { withCors } from "../common/cors";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand, type QueryCommandOutput } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../lib/dynamodb";
import { authenticatedCaller } from "../lib/auth";
import { logError, ordersTable } from "../lib/orders";
import { badRequest, forbidden, internalError, ok, unauthorized } from "../lib/response";
import type { Order } from "../types/order";

async function listOrdersByUserIdHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const caller = authenticatedCaller(event);
  if (!caller) return unauthorized();
  const userId = event.pathParameters?.userId;
  if (!userId) return badRequest("userId es requerido");
  if (userId !== caller.userId) return forbidden("Solo puedes listar tus propias órdenes");
  try {
    const orders: Order[] = [];
    let key: QueryCommandOutput["LastEvaluatedKey"];
    do {
      const result = await dynamo.send(new QueryCommand({ TableName: ordersTable(), IndexName: "user-orders-index", KeyConditionExpression: "userId = :userId", ExpressionAttributeValues: { ":userId": userId }, ExclusiveStartKey: key }));
      orders.push(...(result.Items || []) as Order[]);
      key = result.LastEvaluatedKey;
    } while (key);
    // El índice del taller solo tiene HASH: ordenar explícitamente por fecha.
    orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt) || a.orderId.localeCompare(b.orderId));
    return ok({ orders });
  } catch (error) { logError("listOrdersByUserId", error); return internalError(); }
}

export const listOrdersByUserId = withCors(listOrdersByUserIdHandler);
