const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const jwt = require("jsonwebtoken");
const { aws, registrationURL } = require("./aws-local.cjs");

(async () => {
  const base = registrationURL().replace(/\/register$/, "");
  const ids = new Set(), refreshTokens = new Set(), checks = [];
  const request = async (method, path, body, token) => {
    const response = await fetch(`${base}${path}`, {
      method,
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(90000),
    });
    return { status: response.status, body: await response.json() };
  };
  const check = (caso, response, expected) => {
    assert.equal(response.status, expected, `${caso}: ${JSON.stringify(response.body)}`);
    checks.push({ caso, estado: response.status });
  };
  try {
    const people = [];
    for (const role of ["buyer", "seller"]) {
      const data = { email: `prueba-crud-${randomUUID()}@example.invalid`, password: `Prueba-${randomUUID()}`, name: `Prueba ${role}`, role };
      const created = await request("POST", "/register", data);
      check(`Registro de prueba ${role}`, created, 200);
      ids.add(created.body.userId);
      people.push({ ...data, userId: created.body.userId });
    }
    const [a, b] = people;
    check("Login sin datos", await request("POST", "/login", {}), 400);
    check("Login con password incorrecto", await request("POST", "/login", { email: a.email, password: "incorrecta" }), 401);
    check("Login con email inexistente", await request("POST", "/login", { email: "inexistente@example.invalid", password: a.password }), 401);
    for (const person of people) {
      const login = await request("POST", "/login", { email: person.email, password: person.password });
      check(`Login válido ${person.role}`, login, 200);
      assert.equal(typeof login.body.accessToken, "string");
      assert.equal(typeof login.body.refreshToken, "string");
      person.access = login.body.accessToken;
      refreshTokens.add(login.body.refreshToken);
      const access = jwt.decode(person.access), refresh = jwt.decode(login.body.refreshToken);
      assert.equal(access.userId, person.userId);
      assert.equal(access.exp - access.iat, 3600);
      assert.equal(refresh.exp - refresh.iat, 604800);
      const stored = aws(["dynamodb", "get-item", "--table-name", "taller-users-local-refresh-tokens", "--key", JSON.stringify({ token: { S: login.body.refreshToken } })]).Item;
      assert.equal(stored.userId.S, person.userId);
      assert.ok(Math.abs(Number(stored.expiresAt.N) - refresh.exp) <= 2);
    }
    check("Consulta sin token", await request("GET", `/${a.userId}`), 401);
    check("Consulta con token inválido", await request("GET", `/${a.userId}`, undefined, "token-invalido"), 401);
    const secret = aws(["ssm", "get-parameter", "--name", "/taller/local/jwt-secret", "--with-decryption"]).Parameter.Value;
    const expired = jwt.sign({ userId: a.userId, email: a.email, role: a.role }, secret, { expiresIn: -1 });
    check("Consulta con token vencido", await request("GET", `/${a.userId}`, undefined, expired), 401);
    const profile = await request("GET", `/${a.userId}`, undefined, a.access);
    check("Consulta autorizada", profile, 200);
    assert.equal(profile.body.email, a.email);
    assert.equal("password" in profile.body, false);
    check("Consulta de otro perfil público con token válido", await request("GET", `/${b.userId}`, undefined, a.access), 200);
    check("Actualización de otro usuario bloqueada", await request("PUT", `/${b.userId}`, { name: "No permitido" }, a.access), 400);
    check("Actualización sin nombre", await request("PUT", `/${a.userId}`, {}, a.access), 400);
    const changedName = `${a.name} actualizado`;
    const updated = await request("PUT", `/${a.userId}`, { name: changedName }, a.access);
    check("Actualización del propio perfil", updated, 200);
    assert.equal(updated.body.user.name, changedName);
    assert.equal("password" in updated.body.user, false);
    const changed = await request("GET", `/${a.userId}`, undefined, a.access);
    check("Consulta del cambio persistido", changed, 200);
    assert.equal(changed.body.name, changedName);
    check("Eliminación sin token", await request("DELETE", `/${a.userId}`), 401);
    check("Eliminación de otro usuario bloqueada", await request("DELETE", `/${a.userId}`, undefined, b.access), 400);
    const deleted = await request("DELETE", `/${a.userId}`, undefined, a.access);
    check("Eliminación del propio usuario", deleted, 200);
    assert.equal(deleted.body.user.userId, a.userId);
    assert.equal("password" in deleted.body.user, false);
    ids.delete(a.userId);
    check("Consulta posterior a eliminación", await request("GET", `/${a.userId}`, undefined, a.access), 404);
    check("Login posterior a eliminación", await request("POST", "/login", { email: a.email, password: a.password }), 401);
    writeFileSync(resolve(__dirname, "../../../evidencias/08-users/verificacion-crud.json"), JSON.stringify({ endpoint: base, pruebas: checks, ttlAccessTokenSegundos: 3600, ttlRefreshTokenSegundos: 604800 }, null, 2) + "\n");
    for (const item of checks) console.log(`OK · ${item.caso} · HTTP ${item.estado}`);
    console.log(`${checks.length} comprobaciones completadas. Se conserva el usuario personal para las capturas de Insomnia.`);
  } finally {
    for (const id of ids) aws(["dynamodb", "delete-item", "--table-name", "taller-users-local-users", "--key", JSON.stringify({ userId: { S: id } })]);
    for (const token of refreshTokens) aws(["dynamodb", "delete-item", "--table-name", "taller-users-local-refresh-tokens", "--key", JSON.stringify({ token: { S: token } })]);
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
