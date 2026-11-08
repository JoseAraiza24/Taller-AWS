import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { ScanCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "../lib/dynamodb";
import { logError, productsTable } from "../lib/products";
import { internalError, ok } from "../lib/response";

export async function listAllProducts(_event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    const products: Record<string, unknown>[] = [];
    let cursor: Record<string, unknown> | undefined;
    do { const page = await dynamo.send(new ScanCommand({ TableName: productsTable(), ExclusiveStartKey: cursor })); products.push(...page.Items || []); cursor = page.LastEvaluatedKey; } while (cursor);
    return ok({ products });
  } catch (error) { logError("listAllProducts", error); return internalError(); }
}
