const { randomBytes } = require("node:crypto");
const { existsSync, readFileSync, writeFileSync, chmodSync } = require("node:fs");
const { resolve } = require("node:path");
const { registrationURL } = require("./aws-local.cjs");

const credentialsPath = resolve(__dirname, "../.env.practica.json");
const credentials = existsSync(credentialsPath)
  ? JSON.parse(readFileSync(credentialsPath, "utf8"))
  : { email: process.env.PRACTICE_EMAIL || "alumno@example.test", password: `Taller-${randomBytes(12).toString("base64url")}-7!`, name: process.env.PRACTICE_NAME || "Alumno de práctica", role: process.env.PRACTICE_ROLE || "buyer" };
writeFileSync(credentialsPath, JSON.stringify(credentials, null, 2) + "\n", { mode: 0o600 });
chmodSync(credentialsPath, 0o600);
const endpoint = registrationURL();
writeFileSync(resolve(__dirname, "../../../evidencias/07-users-registro/endpoint.txt"), endpoint + "\n");
const collection = {
  _type: "export", __export_format: 4, __export_source: "taller-users",
  resources: [
    { _id: "__WORKSPACE_ID__", _type: "workspace", name: "Amazon Lite · Taller Users", description: "Actividad 7 · Registro en LocalStack", scope: "collection" },
    { _id: "__BASE_ENVIRONMENT_ID__", _type: "environment", parentId: "__WORKSPACE_ID__", name: "Base Environment", data: {} },
    { _id: "__request_1__", _type: "request", parentId: "__WORKSPACE_ID__", name: `Registro · ${credentials.name}`, method: "POST", url: endpoint, headers: [{ name: "Content-Type", value: "application/json" }], body: { mimeType: "application/json", text: JSON.stringify(credentials, null, 2) } },
  ],
};
const exportPath = resolve(__dirname, "../.env.insomnia.json");
writeFileSync(exportPath, JSON.stringify(collection, null, 2) + "\n", { mode: 0o600 });
chmodSync(exportPath, 0o600);
console.log("Petición preparada para Insomnia. Credenciales de práctica guardadas localmente con permisos 600.");
console.log(endpoint);
