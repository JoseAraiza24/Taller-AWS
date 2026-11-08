import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../lib/dynamodb";
import { authenticatedCaller } from "../lib/auth";
import { getStoredProduct, logError, parseBody, productsTable } from "../lib/products";
import { badRequest, internalError, notFound, ok, unauthorized } from "../lib/response";

export async function updateStock(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  if (!authenticatedCaller(event)) return unauthorized();
  const productId = event.pathParameters?.id;
  if (!productId) return notFound();
  const body = parseBody(event.body);
  const quantity = body?.quantity;
  if (typeof quantity !== "number" || !Number.isInteger(quantity) || quantity <= 0) return badRequest("quantity debe ser un entero positivo");
  try {
    if (!(await getStoredProduct(productId))) return notFound();
    const result = await dynamo.send(new UpdateCommand({ TableName: productsTable(), Key: { productId }, UpdateExpression: "SET stock = stock - :quantity, updatedAt = :now", ConditionExpression: "attribute_exists(productId) AND stock >= :quantity", ExpressionAttributeValues: { ":quantity": quantity, ":now": new Date().toISOString() }, ReturnValues: "ALL_NEW" }));
    return ok({ message: "Stock actualizado exitosamente", product: result.Attributes });
  } catch (error) { if (error instanceof Error && error.name === "ConditionalCheckFailedException") return badRequest("Stock insuficiente"); logError("updateStock", error); return internalError(); }
}
