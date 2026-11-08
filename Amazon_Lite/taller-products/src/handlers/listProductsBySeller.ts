import { withCors } from "../common/cors";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { QueryCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../lib/dynamodb";
import { logError, productsTable } from "../lib/products";
import { internalError, ok } from "../lib/response";

async function listProductsBySellerHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const sellerId = event.pathParameters?.sellerId;
  if (!sellerId) return ok({ products: [] });
  try {
    const products: Record<string, unknown>[] = [];
    let cursor: Record<string, unknown> | undefined;
    do { const page = await dynamo.send(new QueryCommand({ TableName: productsTable(), IndexName: "seller-index", KeyConditionExpression: "sellerId = :sellerId", ExpressionAttributeValues: { ":sellerId": sellerId }, ExclusiveStartKey: cursor })); products.push(...page.Items || []); cursor = page.LastEvaluatedKey; } while (cursor);
    return ok({ products });
  } catch (error) { logError("listProductsBySeller", error); return internalError(); }
}

export const listProductsBySeller = withCors(listProductsBySellerHandler);
