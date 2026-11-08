import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { authenticatedCaller } from "../lib/auth";
import { changePendingStatus, getOrder, logError, sellerHasItems } from "../lib/orders";
import { badRequest, forbidden, internalError, notFound, ok, unauthorized } from "../lib/response";

export async function confirmOrder(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const caller = authenticatedCaller(event);
  if (!caller) return unauthorized();
  const id = event.pathParameters?.id;
  if (!id) return notFound();
  try {
    const order = await getOrder(id);
    if (!order) return notFound();
    if (caller.role !== "seller" || !await sellerHasItems(order, caller.userId)) return forbidden("Solo un vendedor con productos en esta orden puede confirmarla");
    if (order.status !== "pending") return badRequest(`No se puede confirmar una orden con estatus ${order.status}`);
    const updated = await changePendingStatus(id, "confirmed");
    return ok({ message: "Orden confirmada", order: updated });
  } catch (error) {
    if (error instanceof Error && error.name === "ConditionalCheckFailedException") return badRequest("La orden ya no está pending");
    logError("confirmOrder", error); return internalError();
  }
}
