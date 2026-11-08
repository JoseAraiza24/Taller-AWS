import type { APIGatewayProxyEvent } from "aws-lambda";
import { verifyAccessToken } from "./jwt";

export const authenticatedUserId = (event: APIGatewayProxyEvent): string | null => {
  // Esta instancia local omite el autorizador de API Gateway. Verificamos el mismo
  // JWT en la lambda; la configuración del autorizador compartido se conserva.
  if (process.env.STAGE === "local") {
    const header = event.headers?.Authorization || event.headers?.authorization;
    if (!header) return null;
    const token = header.replace(/^Bearer\s+/i, "");
    try {
      const payload = verifyAccessToken(token);
      return typeof payload.userId === "string" && payload.userId && typeof payload.role === "string"
        ? payload.userId : null;
    } catch {
      return null;
    }
  }
  const caller = event.requestContext.authorizer?.userId;
  return typeof caller === "string" && caller ? caller : null;
};
