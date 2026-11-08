const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const bcrypt = require("bcryptjs");
const { aws, registrationURL } = require("./aws-local.cjs");

(async () => {
  const endpoint = registrationURL();
  const checks = [];
  const post = async (body) => {
    const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: typeof body === "string" ? body : JSON.stringify(body), signal: AbortSignal.timeout(90000) });
    return { status: response.status, body: await response.json() };
  };
  let testUserId;
  try {
    for (const [caso, body] of [
      ["Faltan campos obligatorios", {}],
      ["JSON malformado", "{"],
      ["Body nulo", "null"],
      ["Correo inválido", { email: "no-es-correo", password: "Prueba-local", name: "Prueba" }],
      ["Rol inválido", { email: "prueba@example.invalid", password: "Prueba-local", name: "Prueba", role: "admin" }],
    ]) {
      const result = await post(body);
      assert.equal(result.status, 400, caso);
      checks.push({ caso, estado: result.status });
    }
    const payload = { email: `prueba-${randomUUID()}@example.invalid`, password: `Prueba-${randomUUID()}`, name: "Prueba automatizada del registro" };
    const created = await post(payload);
    assert.equal(created.status, 200, JSON.stringify(created.body));
    testUserId = created.body.userId;
    assert.equal(typeof testUserId, "string");
    assert.equal(created.body.role, "buyer");
    assert.equal(created.body.email, payload.email);
    assert.equal(created.body.name, payload.name);
    assert.equal("password" in created.body, false);
    const stored = aws(["dynamodb", "get-item", "--table-name", "taller-users-local-users", "--key", JSON.stringify({ userId: { S: testUserId } }), "--consistent-read"]).Item;
    assert.equal(stored.name.S, payload.name);
    assert.notEqual(stored.password.S, payload.password);
    assert.equal(await bcrypt.compare(payload.password, stored.password.S), true);
    checks.push({ caso: "Usuario creado y persistido; contraseña hasheada y excluida de la respuesta", estado: created.status });
    const duplicate = await post(payload);
    assert.equal(duplicate.status, 400);
    assert.match(duplicate.body.message, /registrado/);
    checks.push({ caso: "Correo duplicado", estado: duplicate.status });
    const stack = aws(["cloudformation", "describe-stacks", "--stack-name", "taller-users-local"]).Stacks[0];
    assert.match(stack.StackStatus, /^(CREATE|UPDATE)_COMPLETE$/);
    writeFileSync(resolve(__dirname, "../../../evidencias/07-users-registro/verificacion.json"), JSON.stringify({ stack: stack.StackName, estado: stack.StackStatus, endpoint, pruebas: checks }, null, 2) + "\n");
    for (const check of checks) console.log(`OK · ${check.caso} · HTTP ${check.estado}`);
    console.log(`Stack ${stack.StackName}: ${stack.StackStatus}`);
  } finally {
    if (testUserId) aws(["dynamodb", "delete-item", "--table-name", "taller-users-local-users", "--key", JSON.stringify({ userId: { S: testUserId } })]);
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
