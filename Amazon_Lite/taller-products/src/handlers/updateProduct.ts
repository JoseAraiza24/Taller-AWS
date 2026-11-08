import { withCors } from "../common/cors";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../lib/dynamodb";
import { authenticatedCaller } from "../lib/auth";
import { getStoredProduct, logError, parseBody, productsTable, validateFields } from "../lib/products";
import { badRequest, forbidden, internalError, notFound, ok, unauthorized } from "../lib/response";

async function updateProductHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const caller = authenticatedCaller(event);
  if (!caller) return unauthorized();
  const productId = event.pathParameters?.id;
  if (!productId) return notFound();
  try {
    const product = await getStoredProduct(productId);
    if (!product) return notFound();
    if (product.sellerId !== caller.userId) return forbidden("Solo puedes actualizar tus propios productos");
    const body = parseBody(event.body);
    if (!body) return badRequest("El body debe contener un objeto JSON válido");
    const invalid = validateFields(body, true);
    if (invalid) return badRequest(invalid);
    const names: Record<string, string> = { "#updated": "updatedAt", "#seller": "sellerId" };
    const values: Record<string, unknown> = { ":updated": new Date().toISOString(), ":seller": caller.userId };
    const updates = ["#updated = :updated"];
    for (const field of ["name", "description", "price", "stock"]) {
      if (body[field] !== undefined) { names[`#${field}`] = field; values[`:${field}`] = typeof body[field] === "string" ? (body[field] as string).trim() : body[field]; updates.push(`#${field} = :${field}`); }
    }
    const result = await dynamo.send(new UpdateCommand({ TableName: productsTable(), Key: { productId }, UpdateExpression: `SET ${updates.join(", ")}`, ExpressionAttributeNames: names, ExpressionAttributeValues: values, ConditionExpression: "attribute_exists(productId) AND #seller = :seller", ReturnValues: "ALL_NEW" }));
    return ok({ message: "Producto actualizado exitosamente", product: result.Attributes });
  } catch (error) { if (error instanceof Error && error.name === "ConditionalCheckFailedException") return notFound(); logError("updateProduct", error); return internalError(); }
}

export const updateProduct = withCors(updateProductHandler);
