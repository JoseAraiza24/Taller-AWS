import type { APIGatewayProxyResult } from "aws-lambda";

const response = (statusCode: number, data: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});
export const ok = (data: unknown) => response(200, data);
export const created = (data: unknown) => response(201, data);
export const badRequest = (message: string) => response(400, { message });
export const unauthorized = () => response(401, { message: "Unauthorized" });
export const forbidden = (message: string) => response(403, { message });
export const notFound = () => response(404, { message: "La orden no se pudo encontrar" });
export const internalError = (message = "Error al procesar la petición de órdenes") => response(500, { message });
