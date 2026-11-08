const { execFileSync } = require("node:child_process");
const { resolve } = require("node:path");
const { mkdirSync } = require("node:fs");

const root = resolve(__dirname, "..");
const modules = ["gateway", "users", "products", "orders"];
const run = (module, args) => execFileSync("npm", args, { cwd: resolve(root, "Amazon_Lite", `taller-${module}`), stdio: "inherit" });
const command = process.argv[2];

try {
  if (command === "install") for (const module of modules) run(module, ["ci", "--no-fund"]);
  else if (command === "typecheck") for (const module of modules) run(module, ["run", "typecheck"]);
  else if (command === "test") {
    run("gateway", ["test"]);
    execFileSync(process.execPath, ["--import", resolve(root, "Amazon_Lite/taller-gateway/node_modules/tsx/dist/loader.mjs"), "--test", "test/cors.test.ts"], { cwd: root, stdio: "inherit" });
  } else if (command === "prepare") for (const module of ["gateway", "users"]) run(module, ["run", "prepare:local"]);
  else if (command === "deploy") for (const module of modules) run(module, ["run", "deploy:local"]);
  else if (command === "verify") {
    for (const path of ["06-deploy-gateway", "07-users-registro", "08-users", "09-products", "10-orders"]) mkdirSync(resolve(root, "evidencias", path), { recursive: true });
    run("gateway", ["run", "verify:local"]);
    run("users", ["run", "verify:local"]);
    run("users", ["run", "verify:crud:local"]);
    run("products", ["run", "verify:local"]);
    run("orders", ["run", "verify:local"]);
  } else if (command === "endpoints") for (const module of ["users", "products", "orders"]) run(module, ["run", "endpoints:local"]);
  else throw new Error("Comando esperado: install, typecheck, test, prepare, deploy, verify o endpoints");
} catch (error) {
  console.error("No se completó el comando del taller.");
  process.exitCode = error.status || 1;
}
