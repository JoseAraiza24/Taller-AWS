import { withCors } from "../common/cors";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { DeleteCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../lib/dynamodb";
import { authenticatedCaller } from "../lib/auth";
import { getStoredProduct, logError, productsTable } from "../lib/products";
import { forbidden, internalError, notFound, ok, unauthorized } from "../lib/response";

async function deleteProductHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const caller = authenticatedCaller(event);
  if (!caller) return unauthorized();
  const productId = event.pathParameters?.id;
  if (!productId) return notFound();
  try {
    const product = await getStoredProduct(productId);
    if (!product) return notFound();
    if (product.sellerId !== caller.userId) return forbidden("Solo puedes borrar productos que tú hayas creado");
    const result = await dynamo.send(new DeleteCommand({ TableName: productsTable(), Key: { productId }, ConditionExpression: "sellerId = :seller", ExpressionAttributeValues: { ":seller": caller.userId }, ReturnValues: "ALL_OLD" }));
    return ok({ message: "Producto borrado exitosamente", product: result.Attributes });
  } catch (error) { if (error instanceof Error && error.name === "ConditionalCheckFailedException") return notFound(); logError("deleteProduct", error); return internalError(); }
}

export const deleteProduct = withCors(deleteProductHandler);
