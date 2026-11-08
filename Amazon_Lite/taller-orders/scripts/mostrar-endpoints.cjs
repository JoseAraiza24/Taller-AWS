const { aws, gatewayBase } = require("./aws-local.cjs");
const base = gatewayBase();
const apiId = new URL(base).pathname.split("/")[2];
const resources = aws(["apigateway", "get-resources", "--rest-api-id", apiId]).items;
console.log("\nEndpoints del módulo Orders desplegados en LocalStack:");
for (const resource of resources.filter(item => item.path === "/orders" || item.path.startsWith("/orders/")).sort((a, b) => a.path.localeCompare(b.path))) {
  for (const method of Object.keys(resource.resourceMethods || {}).sort()) {
    if (method !== "OPTIONS") console.log(`  ${method.padEnd(6)} ${base}${resource.path}`);
  }
}
