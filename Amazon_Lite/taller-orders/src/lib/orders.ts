import type { APIGatewayProxyEvent } from "aws-lambda";
import { GetCommand, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "./dynamodb";
import { invokeLambda, productsFN } from "./lambdaInvoke";
import type { Order } from "../types/order";

export const ordersTable = () => {
  if (!process.env.ORDERS_TABLE) throw new Error("ORDERS_TABLE no está configurado");
  return process.env.ORDERS_TABLE;
};

export const getOrder = async (orderId: string): Promise<Order | undefined> => {
  const response = await dynamo.send(new GetCommand({ TableName: ordersTable(), Key: { orderId }, ConsistentRead: true }));
  return response.Item as Order | undefined;
};

export const parseBody = (value: string | null): Record<string, unknown> | null => {
  try { const parsed = JSON.parse(value || "{}"); return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null; }
  catch { return null; }
};

export const logError = (operation: string, error: unknown) => console.error(`Error en ${operation}`, error instanceof Error ? `${error.name}: ${error.message}` : "Error desconocido");

export const sellerHasItems = async (order: Order, callerId: string): Promise<boolean> => {
  const result = await invokeLambda<{ products: { productId: string }[] }>(productsFN("ListProductsBySeller"), { pathParameters: { sellerId: callerId } });
  if (result.statusCode !== 200 || !Array.isArray(result.body.products)) throw new Error("No se pudieron consultar los productos del vendedor");
  const productIds = new Set(result.body.products.map(product => product.productId));
  return order.items.some(item => productIds.has(item.productId));
};

export const changePendingStatus = async (orderId: string, status: "confirmed" | "canceled"): Promise<Order> => {
  const response = await dynamo.send(new UpdateCommand({
    TableName: ordersTable(), Key: { orderId },
    UpdateExpression: "SET #status = :next, updatedAt = :now",
    ConditionExpression: "attribute_exists(orderId) AND #status = :pending",
    ExpressionAttributeNames: { "#status": "status" },
    ExpressionAttributeValues: { ":next": status, ":pending": "pending", ":now": new Date().toISOString() },
    ReturnValues: "ALL_NEW",
  }));
  return response.Attributes as Order;
};

// Conservar la identidad validada y el Bearer para la verificación local de Products.
export const forwardedIdentity = (event: APIGatewayProxyEvent) => ({ headers: event.headers, requestContext: { authorizer: event.requestContext?.authorizer } });
