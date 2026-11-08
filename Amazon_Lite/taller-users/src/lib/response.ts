import type { APIGatewayProxyResult } from "aws-lambda";

const respond = (statusCode: number, data: unknown): APIGatewayProxyResult => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
  },
  body: JSON.stringify(data),
});

export const ok = (data: unknown) => respond(200, data);
export const badRequest = (message: string) => respond(400, { message });
export const serverError = (message = "Error al registrar el usuario") => respond(500, { message });
export const unauthorized = (message = "Credenciales inválidas") => respond(401, { message });
export const notFound = (message = "Usuario no encontrado") => respond(404, { message });
