import assert from "node:assert/strict";
import { test } from "node:test";
import jwt from "jsonwebtoken";
import type { APIGatewayProxyEvent, APIGatewayTokenAuthorizerEvent } from "aws-lambda";
import { ping } from "../src/handlers/ping";

process.env.JWT_SECRET = "secreto-exclusivo-para-pruebas-unitarias";
const loadAuthorizer = () => import("../src/handlers/authorizer");
const methodArn = "arn:aws:execute-api:us-east-1:000000000000:api/local/GET/users/me";
const event = (token: string): APIGatewayTokenAuthorizerEvent => ({ type: "TOKEN", authorizationToken: token, methodArn });

test("ping devuelve una respuesta JSON válida para API Gateway", async () => {
  const result = await ping({ httpMethod: "GET", path: "/gateway/ping" } as APIGatewayProxyEvent);
  assert.equal(result.statusCode, 200);
  assert.equal(result.headers?.["Content-Type"], "application/json");
  assert.deepEqual(JSON.parse(result.body), { success: true, message: "Hola desde la lambda ping" });
});

test("JWT válido autoriza el método y transmite userId y role", async () => {
  const { authorizer } = await loadAuthorizer();
  const token = jwt.sign({ userId: "usuario-prueba", role: "buyer" }, process.env.JWT_SECRET!, { expiresIn: "5m" });
  const result = await authorizer(event(`Bearer ${token}`));
  assert.equal(result.principalId, "usuario-prueba");
  assert.deepEqual(result.policyDocument.Statement, [{ Action: "execute-api:Invoke", Effect: "Allow", Resource: methodArn }]);
  assert.deepEqual(result.context, { userId: "usuario-prueba", role: "buyer" });
});

test("rechaza token vacío, firma ajena, token vencido y payload incompleto", async () => {
  const { authorizer } = await loadAuthorizer();
  const invalid = [
    "",
    "Bearer ",
    "token-invalido",
    jwt.sign({ userId: "x", role: "buyer" }, "otro-secreto"),
    jwt.sign({ userId: "x", role: "buyer" }, process.env.JWT_SECRET!, { expiresIn: -1 }),
    jwt.sign({ userId: "x" }, process.env.JWT_SECRET!),
  ];
  for (const token of invalid) await assert.rejects(() => authorizer(event(token)), { message: "Unauthorized" });
});
