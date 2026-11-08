const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const { randomBytes } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { resolve } = require("node:path");

const root = resolve(__dirname, "..");
const modules = ["gateway", "users", "products", "orders"];
const bases = ["MainRestApiId", "MainRestApiRootResourceId", "MainAuthorizerId"];
// Valores efímeros solo para compilar: no son secretos de ningún entorno.
const env = { ...process.env, JWT_SECRET: randomBytes(48).toString("base64"), JWT_REFRESH_SECRET: randomBytes(48).toString("base64"), AWS_ACCESS_KEY_ID: "test", AWS_SECRET_ACCESS_KEY: "test", AWS_CONFIG_FILE: "/dev/null", AWS_SHARED_CREDENTIALS_FILE: "/dev/null", AWS_EC2_METADATA_DISABLED: "true", AWS_REGION: "us-east-1", AWS_DEFAULT_REGION: "us-east-1", SLS_TELEMETRY_DISABLED: "1" };
for (const key of ["AWS_PROFILE", "AWS_DEFAULT_PROFILE", "AWS_SESSION_TOKEN", "AWS_SECURITY_TOKEN", "AWS_ENDPOINT_URL"]) delete env[key];

try {
  const exportsByStage = new Map();
  for (const stage of ["develop", "prod"]) {
    const exported = new Set();
    const imported = new Set();
    for (const module of modules) {
      const cwd = resolve(root, "Amazon_Lite", `taller-${module}`);
      const output = resolve(root, "evidencias/comprobacion-entornos", stage, module);
      execFileSync(process.execPath, [resolve(cwd, "node_modules/serverless/bin/serverless.js"), "package", "--stage", stage, "--package", output], { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
      const template = JSON.parse(readFileSync(resolve(cwd, output, "cloudformation-template-update-stack.json"), "utf8"));
      const config = JSON.parse(readFileSync(resolve(cwd, `config/config-${stage}.json`), "utf8"));
      if (stage === "prod") {
        const origins = config.CORS_ORIGINS.split(",").map(value => value.trim());
        assert.ok(origins.every(origin => /^https:\/\//.test(origin) && !/localhost|127\.0\.0\.1|\*/.test(origin)), "Producción requiere un origen HTTPS explícito");
      }
      for (const output of Object.values(template.Outputs || {})) if (output.Export) {
        assert.ok(new RegExp(`(^|-)${stage}(-|$)`).test(output.Export.Name), `Export sin entorno: ${output.Export.Name}`);
        if (bases.some(base => output.Export.Name.startsWith(`${base}-`))) exported.add(output.Export.Name);
      }
      const collect = value => {
        if (Array.isArray(value)) value.forEach(collect);
        else if (value && typeof value === "object") {
          if (value["Fn::ImportValue"]) imported.add(value["Fn::ImportValue"]);
          Object.values(value).forEach(collect);
        }
      };
      collect(template);
      for (const resource of Object.values(template.Resources || {})) {
        if (resource.Type === "AWS::ApiGateway::Method" && resource.Properties.HttpMethod === "OPTIONS") assert.deepEqual(JSON.parse(resource.Properties.Integration.RequestTemplates["application/json"]), { statusCode: 200 });
        if (resource.Type === "AWS::Lambda::Function") assert.ok(resource.Properties.FunctionName.startsWith(`taller-${stage}-`));
        if (resource.Type === "AWS::DynamoDB::Table") assert.ok(resource.Properties.TableName.includes(`-${stage}-`));
      }
      console.log(`OK · ${module} · paquete ${stage} compilado sin desplegar recursos`);
    }
    assert.deepEqual([...exported].sort(), bases.map(base => `${base}-${stage}`).sort());
    assert.ok([...imported].every(name => exported.has(name)), "Hay imports sin export correspondiente en el entorno");
    assert.equal(imported.size, 3);
    exportsByStage.set(stage, exported);
  }
  assert.ok([...exportsByStage.get("develop")].every(name => !exportsByStage.get("prod").has(name)));
  console.log("OK · develop y prod tienen exports distintos e imports coherentes; producción no admite localhost ni comodines.");
} catch (error) {
  const message = error.stderr || error.stdout ? `${error.stdout || ""}\n${error.stderr || ""}`.replace(/eyJ[A-Za-z0-9_.-]+/g, "[token]") : error.message;
  console.error(message);
  process.exitCode = 1;
}
