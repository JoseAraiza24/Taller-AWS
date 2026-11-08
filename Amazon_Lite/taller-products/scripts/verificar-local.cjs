const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { aws, gatewayBase } = require("./aws-local.cjs");

(async () => {
  const base = gatewayBase(), checks = [], users = new Set(), products = new Set(), tokens = new Set();
  const request = async (method, path, body, token) => {
    const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }), signal: AbortSignal.timeout(90000) });
    return { status: response.status, body: await response.json() };
  };
  const check = (caso, result, status) => { assert.equal(result.status, status, `${caso}: ${JSON.stringify(result.body)}`); checks.push({ caso, estado: status }); };
  try {
    const people = [];
    for (const role of ["seller", "seller", "buyer"]) {
      const data = { email: `prueba-products-${randomUUID()}@example.invalid`, password: `Prueba-${randomUUID()}`, name: `Prueba Products ${role}`, role };
      const created = await request("POST", "/users/register", data); assert.equal(created.status, 200); users.add(created.body.userId);
      const login = await request("POST", "/users/login", { email: data.email, password: data.password }); assert.equal(login.status, 200); tokens.add(login.body.refreshToken);
      people.push({ id: created.body.userId, access: login.body.accessToken });
    }
    const [seller, other, buyer] = people;
    const data = { name: "Producto sintético de prueba", description: "Dato desechable para comprobaciones automatizadas de Products", price: 150, stock: 10 };
    check("Creación sin token", await request("POST", "/products/create", data), 401);
    check("Creación por comprador bloqueada", await request("POST", "/products/create", data, buyer.access), 403);
    check("Creación con datos incompletos", await request("POST", "/products/create", {}, seller.access), 400);
    check("Precio negativo", await request("POST", "/products/create", { ...data, price: -1 }, seller.access), 400);
    check("Stock fraccionario", await request("POST", "/products/create", { ...data, stock: 1.5 }, seller.access), 400);
    const created = await request("POST", "/products/create", data, seller.access); check("Producto creado por vendedor", created, 201);
    const id = created.body.productId; products.add(id); assert.equal(created.body.sellerId, seller.id);
    const otherProduct = await request("POST", "/products/create", { ...data, name: "Producto de otro vendedor" }, other.access); assert.equal(otherProduct.status, 201); products.add(otherProduct.body.productId);
    const found = await request("GET", `/products/${id}`); check("Consulta pública", found, 200); assert.equal(found.body.name, data.name);
    const all = await request("GET", "/products"); check("Listado público de todos", all, 200); assert.ok(all.body.products.some((x) => x.productId === id)); assert.ok(all.body.products.some((x) => x.productId === otherProduct.body.productId));
    const bySeller = await request("GET", `/products/users/${seller.id}`); check("Listado filtrado por vendedor", bySeller, 200); assert.ok(bySeller.body.products.some((x) => x.productId === id)); assert.ok(bySeller.body.products.every((x) => x.sellerId === seller.id));
    const noProducts = await request("GET", `/products/users/${randomUUID()}`); check("Vendedor sin productos", noProducts, 200); assert.deepEqual(noProducts.body.products, []);
    check("Actualización sin token", await request("PUT", `/products/${id}`, { name: "Cambio" }), 401);
    check("Actualización ajena bloqueada", await request("PUT", `/products/${id}`, { name: "No permitido" }, other.access), 403);
    check("Actualización vacía", await request("PUT", `/products/${id}`, {}, seller.access), 400);
    const updated = await request("PUT", `/products/${id}`, { name: "Producto actualizado", price: 175, stock: 8 }, seller.access); check("Actualización parcial del propietario", updated, 200); assert.equal(updated.body.product.description, data.description); assert.equal(updated.body.product.stock, 8);
    check("Stock sin autenticación", await request("PATCH", `/products/${id}/stock`, { quantity: 2 }), 401);
    check("Cantidad cero", await request("PATCH", `/products/${id}/stock`, { quantity: 0 }, buyer.access), 400);
    check("Cantidad negativa", await request("PATCH", `/products/${id}/stock`, { quantity: -1 }, buyer.access), 400);
    check("Cantidad fraccionaria", await request("PATCH", `/products/${id}/stock`, { quantity: 0.5 }, buyer.access), 400);
    const stock = await request("PATCH", `/products/${id}/stock`, { quantity: 3 }, buyer.access); check("Descuento de stock autenticado", stock, 200); assert.equal(stock.body.product.stock, 5);
    check("Descuento superior al stock", await request("PATCH", `/products/${id}/stock`, { quantity: 6 }, buyer.access), 400);
    await request("PUT", `/products/${id}`, { stock: 1 }, seller.access);
    const concurrent = await Promise.all([request("PATCH", `/products/${id}/stock`, { quantity: 1 }, buyer.access), request("PATCH", `/products/${id}/stock`, { quantity: 1 }, buyer.access)]);
    assert.deepEqual(concurrent.map((x) => x.status).sort(), [200, 400]);
    const empty = await request("GET", `/products/${id}`); assert.equal(empty.body.stock, 0); checks.push({ caso: "Descuentos simultáneos: solo uno consume la última unidad; stock final cero", estado: 200 });
    check("Eliminación ajena bloqueada", await request("DELETE", `/products/${id}`, undefined, other.access), 403);
    check("Eliminación del producto propio de prueba", await request("DELETE", `/products/${id}`, undefined, seller.access), 200); products.delete(id);
    check("Producto eliminado devuelve 404", await request("GET", `/products/${id}`), 404);
    const stack = aws(["cloudformation", "describe-stacks", "--stack-name", "taller-products-local"]).Stacks[0]; assert.match(stack.StackStatus, /^(CREATE|UPDATE)_COMPLETE$/);
    writeFileSync(resolve(__dirname, "../../../evidencias/09-products/verificacion.json"), JSON.stringify({ stack: stack.StackName, estado: stack.StackStatus, pruebas: checks }, null, 2) + "\n");
    for (const item of checks) console.log(`OK · ${item.caso} · HTTP ${item.estado}`);
    console.log(`${checks.length} comprobaciones completadas.`);
  } finally {
    for (const id of products) aws(["dynamodb", "delete-item", "--table-name", "taller-products-local-products", "--key", JSON.stringify({ productId: { S: id } })]);
    for (const id of users) aws(["dynamodb", "delete-item", "--table-name", "taller-users-local-users", "--key", JSON.stringify({ userId: { S: id } })]);
    for (const token of tokens) aws(["dynamodb", "delete-item", "--table-name", "taller-users-local-refresh-tokens", "--key", JSON.stringify({ token: { S: token } })]);
  }
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
