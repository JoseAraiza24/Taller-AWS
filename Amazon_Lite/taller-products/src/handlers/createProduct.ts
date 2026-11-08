import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuidv4 } from "uuid";
import { dynamo } from "../lib/dynamodb";
import { authenticatedCaller } from "../lib/auth";
import { badRequest, created, forbidden, internalError, unauthorized } from "../lib/response";
import { logError, parseBody, productsTable, validateFields } from "../lib/products";
import type { Product } from "../types/product";

export async function createProduct(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const caller = authenticatedCaller(event);
  if (!caller) return unauthorized();
  if (caller.role !== "seller") return forbidden("Solo vendedores pueden crear productos");
  const body = parseBody(event.body);
  if (!body) return badRequest("El body debe contener un objeto JSON válido");
  const invalid = validateFields(body);
  if (invalid) return badRequest(invalid);
  try {
    const now = new Date().toISOString();
    const product: Product = { productId: uuidv4(), sellerId: caller.userId, name: (body.name as string).trim(), description: (body.description as string).trim(), price: body.price as number, stock: body.stock as number, createdAt: now, updatedAt: now };
    await dynamo.send(new PutCommand({ TableName: productsTable(), Item: product, ConditionExpression: "attribute_not_exists(productId)" }));
    return created(product);
  } catch (error) { logError("createProduct", error); return internalError(); }
}
