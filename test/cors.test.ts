import test from "node:test";
import assert from "node:assert/strict";
import type { APIGatewayProxyEvent } from "../Amazon_Lite/taller-gateway/node_modules/@types/aws-lambda";
import { withCors as gatewayCors } from "../Amazon_Lite/taller-gateway/src/common/cors";
import { withCors as usersCors } from "../Amazon_Lite/taller-users/src/common/cors";
import { withCors as productsCors } from "../Amazon_Lite/taller-products/src/common/cors";
import { withCors as ordersCors } from "../Amazon_Lite/taller-orders/src/common/cors";

const event = (headers: Record<string, string> = {}, method = "GET") => ({ headers, httpMethod: method } as APIGatewayProxyEvent);
const original = process.env.CORS_ORIGINS;
test.after(() => { if (original === undefined) delete process.env.CORS_ORIGINS; else process.env.CORS_ORIGINS = original; });

for (const [module, wrap] of [["Gateway", gatewayCors], ["Users", usersCors], ["Products", productsCors], ["Orders", ordersCors]] as const) {
  test(`${module}: admite el origen configurado y conserva cuerpo y estado`, async () => {
    process.env.CORS_ORIGINS = " http://localhost:3000, https://app.example.test ";
    const result = await wrap(async () => ({ statusCode: 201, body: '{"ok":true}', headers: { "Content-Type": "application/json", Vary: "Accept-Encoding" } }))(event({ origin: "http://localhost:3000" }));
    assert.equal(result.statusCode, 201); assert.equal(result.body, '{"ok":true}');
    assert.equal(result.headers?.["Access-Control-Allow-Origin"], "http://localhost:3000");
    assert.equal(result.headers?.Vary, "Accept-Encoding, Origin");
    assert.equal(result.headers?.["Content-Type"], "application/json");
  });
  test(`${module}: admite Origin en otra capitalización y un segundo origen`, async () => {
    process.env.CORS_ORIGINS = "http://localhost:3000,https://app.example.test";
    const result = await wrap(async () => ({ statusCode: 200, body: "{}" }))(event({ Origin: "https://app.example.test" }));
    assert.equal(result.headers?.["Access-Control-Allow-Origin"], "https://app.example.test");
  });
  test(`${module}: un puerto diferente no recibe permiso CORS ni hereda un comodín`, async () => {
    process.env.CORS_ORIGINS = "http://localhost:3000";
    const result = await wrap(async () => ({ statusCode: 200, body: "{}", headers: { "Access-Control-Allow-Origin": "*" } }))(event({ origin: "http://localhost:3005" }));
    assert.equal(result.headers?.["Access-Control-Allow-Origin"], undefined);
  });
  test(`${module}: permite invocación interna sin Origin y sin generar un origen falso`, async () => {
    process.env.CORS_ORIGINS = "http://localhost:3000";
    const result = await wrap(async () => ({ statusCode: 200, body: "{}" }))(event());
    assert.equal(result.statusCode, 200); assert.equal(result.headers?.["Access-Control-Allow-Origin"], undefined);
  });
  test(`${module}: OPTIONS no ejecuta la lógica de negocio`, async () => {
    process.env.CORS_ORIGINS = "http://localhost:3000";
    let called = false;
    const result = await wrap(async () => { called = true; throw new Error("No debe llamarse"); })(event({ origin: "http://localhost:3000" }, "OPTIONS"));
    assert.equal(called, false); assert.equal(result.statusCode, 204);
    assert.equal(result.headers?.["Access-Control-Allow-Origin"], "http://localhost:3000");
    assert.match(String(result.headers?.["Access-Control-Allow-Headers"]), /Authorization/);
    assert.match(String(result.headers?.["Access-Control-Allow-Methods"]), /PATCH,DELETE,OPTIONS/);
  });
  test(`${module}: conserva errores 401 con CORS`, async () => {
    process.env.CORS_ORIGINS = "http://localhost:3000";
    const result = await wrap(async () => ({ statusCode: 401, body: '{"message":"Unauthorized"}' }))(event({ origin: "http://localhost:3000" }));
    assert.equal(result.statusCode, 401); assert.equal(result.headers?.["Access-Control-Allow-Origin"], "http://localhost:3000");
  });
  test(`${module}: error no controlado devuelve 500 con CORS y sin divulgar detalles`, async () => {
    process.env.CORS_ORIGINS = "http://localhost:3000";
    const result = await wrap(async () => { throw new Error("detalle privado de prueba"); })(event({ origin: "http://localhost:3000" }));
    assert.equal(result.statusCode, 500); assert.equal(result.headers?.["Access-Control-Allow-Origin"], "http://localhost:3000");
    assert.equal(result.body.includes("detalle privado"), false);
  });
  test(`${module}: falta de configuración falla sin otorgar acceso a cualquier origen`, async () => {
    delete process.env.CORS_ORIGINS;
    const result = await wrap(async () => ({ statusCode: 200, body: "{}" }))(event({ origin: "http://localhost:3000" }));
    assert.equal(result.headers?.["Access-Control-Allow-Origin"], undefined);
  });
}
