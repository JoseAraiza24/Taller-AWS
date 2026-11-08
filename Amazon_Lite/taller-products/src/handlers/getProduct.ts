import { withCors } from "../common/cors";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { getStoredProduct, logError } from "../lib/products";
import { internalError, notFound, ok } from "../lib/response";

async function getProductHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const id = event.pathParameters?.id;
  if (!id) return notFound();
  try { const product = await getStoredProduct(id); return product ? ok(product) : notFound(); }
  catch (error) { logError("getProduct", error); return internalError(); }
}

export const getProduct = withCors(getProductHandler);
