import { withCors } from "../common/cors";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { authenticatedCaller } from "../lib/auth";
import { getOrder as getStoredOrder, logError } from "../lib/orders";
import { forbidden, internalError, notFound, ok, unauthorized } from "../lib/response";

async function getOrderHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const caller = authenticatedCaller(event);
  if (!caller) return unauthorized();
  const id = event.pathParameters?.id;
  if (!id) return notFound();
  try {
    const order = await getStoredOrder(id);
    if (!order) return notFound();
    if (order.userId !== caller.userId) return forbidden("Solo puedes ver las órdenes que tú hayas generado");
    return ok({ order });
  } catch (error) { logError("getOrder", error); return internalError(); }
}

export const getOrder = withCors(getOrderHandler);
