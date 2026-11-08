import { withCors } from "../common/cors";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { authenticatedCaller } from "../lib/auth";
import { changePendingStatus, getOrder, logError, sellerHasItems } from "../lib/orders";
import { badRequest, forbidden, internalError, notFound, ok, unauthorized } from "../lib/response";

async function cancelOrderHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const caller = authenticatedCaller(event);
  if (!caller) return unauthorized();
  const id = event.pathParameters?.id;
  if (!id) return notFound();
  try {
    const order = await getOrder(id);
    if (!order) return notFound();
    const isBuyer = order.userId === caller.userId;
    const isSeller = caller.role === "seller" && await sellerHasItems(order, caller.userId);
    if (!isBuyer && !isSeller) return forbidden("Solo puedes cancelar órdenes que tú hiciste o que contengan productos que tú vendes");
    if (order.status !== "pending") return badRequest(`No se puede cancelar una orden con estatus ${order.status}`);
    const updated = await changePendingStatus(id, "canceled");
    return ok({ message: "Orden cancelada", order: updated });
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") return badRequest("La orden ya no está pending");
    logError("cancelOrder", error); return internalError();
  }
}

export const cancelOrder = withCors(cancelOrderHandler);
