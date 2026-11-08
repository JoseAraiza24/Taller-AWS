const { execFileSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { mkdtempSync, writeFileSync, rmSync } = require("node:fs");
const { tmpdir } = require("node:os");
const { join } = require("node:path");

const endpoint = "http://127.0.0.1:4566";
const name = "/taller/local/jwt-secret";
const env = {
  ...process.env,
  AWS_ACCESS_KEY_ID: "test",
  AWS_SECRET_ACCESS_KEY: "test",
  AWS_CONFIG_FILE: "/dev/null",
  AWS_SHARED_CREDENTIALS_FILE: "/dev/null",
  AWS_REGION: "us-east-1",
  AWS_DEFAULT_REGION: "us-east-1",
  AWS_EC2_METADATA_DISABLED: "true",
  AWS_PAGER: "",
  AWS_CLI_AUTO_PROMPT: "off",
};
for (const key of ["AWS_PROFILE", "AWS_DEFAULT_PROFILE", "AWS_SESSION_TOKEN", "AWS_SECURITY_TOKEN"]) delete env[key];
const args = ["--endpoint-url", endpoint, "--region", "us-east-1", "ssm"];

try {
  const found = JSON.parse(execFileSync("aws", [...args, "describe-parameters", "--parameter-filters", `Key=Name,Values=${name}`, "--output", "json"], { env, encoding: "utf8" }));
  if (found.Parameters.length) {
    console.log("SSM local: el secreto JWT ya existe; se conserva su valor.");
  } else {
    const temp = mkdtempSync(join(tmpdir(), "taller-jwt-"));
    try {
      const inputFile = join(temp, "parameter.json");
      writeFileSync(inputFile, JSON.stringify({ Name: name, Type: "SecureString", Value: randomBytes(64).toString("base64") }), { mode: 0o600 });
      execFileSync("aws", [...args, "put-parameter", "--cli-input-json", `file://${inputFile}`], { env, stdio: ["ignore", "pipe", "pipe"] });
    } finally {
      rmSync(temp, { recursive: true, force: true });
    }
    console.log("SSM local: secreto JWT creado correctamente.");
  }
} catch (error) {
  console.error("No se pudo preparar SSM en LocalStack. Comprueba que el entorno esté iniciado.");
  process.exitCode = 1;
}
