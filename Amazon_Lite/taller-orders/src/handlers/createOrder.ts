import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";
import { PutCommand } from "@aws-sdk/lib-dynamodb";
import { v4 as uuid } from "uuid";
import { dynamo } from "../lib/dynamodb";
import { authenticatedCaller } from "../lib/auth";
import { invokeLambda, productsFN } from "../lib/lambdaInvoke";
import { changePendingStatus, forwardedIdentity, logError, ordersTable, parseBody } from "../lib/orders";
import { badRequest, created, internalError, unauthorized } from "../lib/response";
import type { Order, OrderItem } from "../types/order";

interface Product { productId: string; price: number; stock: number; name: string }

export async function createOrder(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  const caller = authenticatedCaller(event);
  if (!caller) return unauthorized();
  const body = parseBody(event.body);
  if (!Array.isArray(body?.items) || !body.items.length) return badRequest("items es requerido y debe ser un arreglo no vacío");
  const quantities = new Map<string, number>();
  for (const item of body.items) {
    if (!item || typeof item !== "object" || typeof item.productId !== "string" || !item.productId.trim() || !Number.isSafeInteger(item.quantity) || item.quantity < 1) return badRequest("Cada ítem requiere productId y quantity entero positivo");
    const quantity = (quantities.get(item.productId.trim()) || 0) + item.quantity;
    if (!Number.isSafeInteger(quantity)) return badRequest("Cantidad inválida");
    quantities.set(item.productId.trim(), quantity);
  }
  try {
    const resolved: OrderItem[] = [];
    for (const [productId, quantity] of quantities) {
      const result = await invokeLambda<Product>(productsFN("GetProduct"), { pathParameters: { id: productId } });
      if (result.statusCode === 404) return badRequest(`El producto ${productId} no existe`);
      if (result.statusCode !== 200) throw new Error("No se pudo consultar un producto");
      const product = result.body;
      if (!Number.isFinite(product.price) || product.price <= 0 || !Number.isSafeInteger(product.stock)) throw new Error("Datos de producto inválidos");
      if (product.stock < quantity) return badRequest(`Stock insuficiente para ${product.name}; disponibles: ${product.stock}`);
      resolved.push({ productId, quantity, price: product.price });
    }
    const total = Number(resolved.reduce((sum, item) => sum + item.price * item.quantity, 0).toFixed(2));
    if (!Number.isFinite(total)) return badRequest("Total inválido");
    const now = new Date().toISOString();
    const order: Order = { orderId: uuid(), userId: caller.userId, items: resolved, total, status: "pending", createdAt: now, updatedAt: now };
    await dynamo.send(new PutCommand({ TableName: ordersTable(), Item: order, ConditionExpression: "attribute_not_exists(orderId)" }));
    // Flujo didáctico del video: registrar y luego reservar mediante Products.
    // No es una transacción distribuida; una reserva parcial requiere compensación.
    for (const item of resolved) {
      try {
        const result = await invokeLambda<unknown>(productsFN("UpdateStock"), { ...forwardedIdentity(event), pathParameters: { id: item.productId }, body: JSON.stringify({ quantity: item.quantity }) });
        if (result.statusCode !== 200) throw new Error(`Products respondió ${result.statusCode} al reservar stock`);
      } catch (error) {
        logError("createOrder/reservarStock", error);
        await changePendingStatus(order.orderId, "canceled");
        return internalError("No se pudo reservar el stock para uno o más productos. La orden ha sido cancelada");
      }
    }
    return created(order);
  } catch (error) { logError("createOrder", error); return internalError(); }
}
