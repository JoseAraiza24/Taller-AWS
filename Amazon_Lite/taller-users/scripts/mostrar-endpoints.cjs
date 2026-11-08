const { aws, registrationURL } = require("./aws-local.cjs");
const register = registrationURL();
const apiId = new URL(register).pathname.split("/")[2];
const base = register.replace(/\/users\/register$/, "");
const resources = aws(["apigateway", "get-resources", "--rest-api-id", apiId]).items;
console.log("\nEndpoints desplegados en API Gateway / LocalStack:");
for (const resource of resources.sort((a, b) => a.path.localeCompare(b.path))) {
  for (const method of Object.keys(resource.resourceMethods || {}).sort()) {
    if (method !== "OPTIONS") console.log(`  ${method.padEnd(5)} ${base}${resource.path}`);
  }
}
