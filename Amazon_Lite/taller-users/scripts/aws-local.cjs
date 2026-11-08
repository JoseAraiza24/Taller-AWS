const { execFileSync } = require("node:child_process");
const { resolve } = require("node:path");

const localCLI = resolve(__dirname, "../../../scripts/awslocal");
const aws = (args) => {
  const output = execFileSync(localCLI, [...args, "--output", "json"], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  return output.trim() ? JSON.parse(output) : {};
};
const registrationURL = () => {
  const exports = aws(["cloudformation", "list-exports"]).Exports;
  const apiId = exports.find((item) => item.Name === "MainRestApiId")?.Value;
  if (!apiId) throw new Error("Primero despliega el módulo Taller Gateway");
  return `http://127.0.0.1:4566/restapis/${apiId}/local/_user_request_/users/register`;
};
module.exports = { aws, registrationURL };
