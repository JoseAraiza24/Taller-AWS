import type { APIGatewayProxyEvent, APIGatewayProxyResult } from "aws-lambda";

type HttpHandler = (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult>;

export const CORS_HEADERS = "Content-Type,Authorization,X-Api-Key,X-Amz-Date,X-Amz-Security-Token";
export const CORS_METHODS = "GET,POST,PUT,PATCH,DELETE,OPTIONS";

export function withCors(handler: HttpHandler): HttpHandler {
  return async event => {
    const origins = (process.env.CORS_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean);
    const origin = Object.entries(event.headers || {}).find(([key]) => key.toLowerCase() === "origin")?.[1] || "";
    const allowedOrigin = origin && origins.includes(origin) ? origin : "";
    let result: APIGatewayProxyResult;
    try {
      result = event.httpMethod?.toUpperCase() === "OPTIONS"
        ? { statusCode: 204, body: "" }
        : await handler(event);
    } catch (error) {
      console.error("Error no controlado en Lambda", error instanceof Error ? error.name : "UnknownError");
      result = { statusCode: 500, body: JSON.stringify({ message: "Error interno del servidor" }), headers: { "Content-Type": "application/json" } };
    }
    const headers = Object.fromEntries(Object.entries(result.headers || {}).filter(([key]) => !key.toLowerCase().startsWith("access-control-")));
    const varyKey = Object.keys(headers).find(key => key.toLowerCase() === "vary");
    const vary = String(varyKey ? headers[varyKey] : "").split(",").map(value => value.trim()).filter(Boolean);
    if (varyKey) delete headers[varyKey];
    if (!vary.some(value => value.toLowerCase() === "origin")) vary.push("Origin");
    return {
      ...result,
      headers: {
        ...headers,
        Vary: vary.join(", "),
        "Access-Control-Allow-Headers": CORS_HEADERS,
        "Access-Control-Allow-Methods": CORS_METHODS,
        ...(allowedOrigin ? { "Access-Control-Allow-Origin": allowedOrigin } : {}),
      },
    };
  };
}
