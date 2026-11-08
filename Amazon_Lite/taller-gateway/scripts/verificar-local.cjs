const { execFileSync } = require("node:child_process");
const { mkdtempSync, readFileSync, writeFileSync, rmSync } = require("node:fs");
const { join, resolve } = require("node:path");
const { tmpdir } = require("node:os");
const assert = require("node:assert/strict");
const jwt = require("jsonwebtoken");

const env = { ...process.env, AWS_ACCESS_KEY_ID: "test", AWS_SECRET_ACCESS_KEY: "test", AWS_CONFIG_FILE: "/dev/null", AWS_SHARED_CREDENTIALS_FILE: "/dev/null", AWS_DEFAULT_REGION: "us-east-1", AWS_REGION: "us-east-1", AWS_EC2_METADATA_DISABLED: "true", AWS_PAGER: "", AWS_CLI_AUTO_PROMPT: "off" };
for (const key of ["AWS_PROFILE", "AWS_DEFAULT_PROFILE", "AWS_SESSION_TOKEN", "AWS_SECURITY_TOKEN"]) delete env[key];
const aws = (args) => JSON.parse(execFileSync("aws", ["--endpoint-url", "http://127.0.0.1:4566", "--region", "us-east-1", ...args, "--output", "json"], { env, encoding: "utf8" }));

(async () => {
  const stack = aws(["cloudformation", "describe-stacks", "--stack-name", "taller-gateway-local"]).Stacks[0];
  assert.match(stack.StackStatus, /^(CREATE|UPDATE)_COMPLETE$/);
  const apiId = stack.Outputs.find((x) => x.OutputKey === "MainRestApiId").OutputValue;
  const endpoint = `http://127.0.0.1:4566/restapis/${apiId}/local/_user_request_/gateway/ping`;
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(90000) });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.message, "Hola desde la lambda ping");
  console.log(`GET ${endpoint}`);
  console.log(`HTTP ${response.status} ${JSON.stringify(body)}`);

  const functions = ["taller-local-Gateway-Ping", "taller-local-Authorizer"].map((FunctionName) => {
    const f = aws(["lambda", "get-function-configuration", "--function-name", FunctionName]);
    assert.equal(f.State, "Active");
    return { nombre: f.FunctionName, runtime: f.Runtime, estado: f.State };
  });
  const secret = aws(["ssm", "get-parameter", "--name", "/taller/local/jwt-secret", "--with-decryption"]).Parameter.Value;
  const temp = mkdtempSync(join(tmpdir(), "taller-lambda-test-"));
  const methodArn = `arn:aws:execute-api:us-east-1:000000000000:${apiId}/local/GET/users/me`;
  const invoke = (token) => {
    const inputFile = join(temp, "event.json");
    const outputFile = join(temp, "result.json");
    writeFileSync(inputFile, JSON.stringify({ type: "TOKEN", authorizationToken: token, methodArn }), { mode: 0o600 });
    const metadata = aws(["lambda", "invoke", "--function-name", "taller-local-Authorizer", "--cli-binary-format", "raw-in-base64-out", "--payload", `file://${inputFile}`, outputFile]);
    return { metadata, result: JSON.parse(readFileSync(outputFile, "utf8")) };
  };
  const authorizerChecks = [];
  try {
    const token = jwt.sign({ userId: "usuario-prueba", role: "buyer" }, secret, { expiresIn: "5m" });
    const valid = invoke(`Bearer ${token}`);
    assert.equal(valid.metadata.FunctionError, undefined);
    assert.equal(valid.result.principalId, "usuario-prueba");
    assert.deepEqual(valid.result.context, { userId: "usuario-prueba", role: "buyer" });
    assert.equal(valid.result.policyDocument.Statement[0].Effect, "Allow");
    assert.equal(valid.result.policyDocument.Statement[0].Resource, methodArn);
    authorizerChecks.push({ caso: "JWT válido", resultado: "Allow" });
    for (const [caso, invalidToken] of [
      ["Firma inválida", jwt.sign({ userId: "x", role: "buyer" }, "secreto-ajeno")],
      ["JWT vencido", jwt.sign({ userId: "x", role: "buyer" }, secret, { expiresIn: -1 })],
      ["Token vacío", ""],
    ]) {
      const invalid = invoke(invalidToken);
      assert.equal(invalid.metadata.FunctionError, "Unhandled");
      assert.equal(invalid.result.errorMessage, "Unauthorized");
      authorizerChecks.push({ caso, resultado: "Unauthorized" });
    }
  } finally {
    rmSync(temp, { recursive: true, force: true });
  }
  for (const check of authorizerChecks) console.log(`Authorizer: ${check.caso} -> ${check.resultado}`);
  const result = { stack: stack.StackName, estado: stack.StackStatus, endpoint, ping: { status: response.status, body }, funciones: functions, authorizer: authorizerChecks };
  writeFileSync(resolve(__dirname, "../../../evidencias/06-deploy-gateway/verificacion.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(`Stack: ${stack.StackName} - ${stack.StackStatus}`);
})().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
