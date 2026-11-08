import { withCors } from "../common/cors";
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

async function pingHandler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  console.log("Hola desde la lambda ping");
  console.log("Evento desde API Gateway", event);

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      success: true,
      message: "Hola desde la lambda ping",
    }),
  };
}

export const ping = withCors(pingHandler);
