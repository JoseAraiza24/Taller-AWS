const assert = require("node:assert/strict");
const { mkdirSync, writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { aws, gatewayBase } = require("../Amazon_Lite/taller-products/scripts/aws-local.cjs");

(async () => {
  const base = gatewayBase(), origin = "http://localhost:3000", checks = [];
  const routes = [
    ["GET", "/gateway/ping", 200],
    ["POST", "/users/register", 400], ["POST", "/users/login", 400],
    ["GET", "/users/cors-inexistente", 401], ["PUT", "/users/cors-inexistente", 401], ["DELETE", "/users/cors-inexistente", 401],
    ["POST", "/products/create", 401], ["GET", "/products/cors-inexistente", 404],
    ["PUT", "/products/cors-inexistente", 401], ["DELETE", "/products/cors-inexistente", 401],
    ["GET", "/products", 200], ["GET", "/products/users/cors-inexistente", 200], ["PATCH", "/products/cors-inexistente/stock", 401],
    ["POST", "/orders/create", 401], ["GET", "/orders/cors-inexistente", 401], ["GET", "/orders/list/users/cors-inexistente", 401],
    ["POST", "/orders/cors-inexistente/confirm", 401], ["POST", "/orders/cors-inexistente/cancel", 401],
  ];
  for (const [method, path, status] of routes) {
    const response = await fetch(`${base}${path}`, { method, headers: { Origin: origin, ...(method === "GET" ? {} : { "Content-Type": "application/json" }) }, ...(method === "GET" ? {} : { body: "{}" }), signal: AbortSignal.timeout(90000) });
    await response.text();
    assert.equal(response.status, status, `${method} ${path}`);
    assert.equal(response.headers.get("access-control-allow-origin"), origin, `${method} ${path}: falta CORS`);
    assert.match(response.headers.get("vary") || "", /Origin/i);
    assert.match(response.headers.get("access-control-allow-headers") || "", /Authorization/i);
    checks.push({ metodo: method, ruta: path, estado: status, origen: origin });
    console.log(`OK · ${method} ${path} · HTTP ${status} con CORS`);
  }
  for (const path of new Set(routes.map(route => route[1]))) {
    const method = routes.find(route => route[1] === path)[0];
    const response = await fetch(`${base}${path}`, { method: "OPTIONS", headers: { Origin: origin, "Access-Control-Request-Method": method, "Access-Control-Request-Headers": "authorization,content-type" }, signal: AbortSignal.timeout(90000) });
    await response.text();
    assert.equal(response.status, 200, `OPTIONS ${path}`);
    assert.equal(response.headers.get("access-control-allow-origin"), origin);
    assert.match(response.headers.get("access-control-allow-headers") || "", /Authorization/i);
    assert.match(response.headers.get("access-control-allow-methods") || "", /OPTIONS/);
    assert.ok((response.headers.get("access-control-allow-methods") || "").split(",").map(value => value.trim()).includes(method));
    checks.push({ metodo: "OPTIONS", ruta: path, estado: response.status, origen: origin });
  }
  const denied = await fetch(`${base}/products`, { headers: { Origin: "http://localhost:3005" }, signal: AbortSignal.timeout(90000) });
  await denied.text(); assert.equal(denied.headers.get("access-control-allow-origin"), null);
  checks.push({ metodo: "GET", ruta: "/products", origenNoPermitido: "http://localhost:3005", permisoCors: false });
  const exports = aws(["cloudformation", "list-exports"]).Exports;
  for (const name of ["MainRestApiId", "MainRestApiRootResourceId", "MainAuthorizerId"]) {
    assert.ok(exports.some(item => item.Name === `${name}-local`));
    assert.ok(!exports.some(item => item.Name === name), `Quedó el export estático ${name}`);
  }
  const directory = resolve(__dirname, "../evidencias/11-github"); mkdirSync(directory, { recursive: true });
  writeFileSync(resolve(directory, "verificacion-cors-local.json"), JSON.stringify({ pruebas: checks, exports: exports.map(item => item.Name) }, null, 2) + "\n");
  console.log(`${checks.length} comprobaciones HTTP de CORS completadas.`);
})().catch(error => { console.error(error.message); process.exitCode = 1; });
