const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const { writeFileSync } = require("node:fs");
const { resolve } = require("node:path");
const { aws, gatewayBase } = require("./aws-local.cjs");

(async () => {
  const base = gatewayBase(), checks = [], users = new Set(), products = new Set(), orders = new Set(), tokens = new Set(), emails = new Set();
  const request = async (method, path, body, token) => {
    const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }), signal: AbortSignal.timeout(90000) });
    return { status: response.status, body: await response.json() };
  };
  const check = (caso, result, status) => { assert.equal(result.status, status, `${caso}: ${JSON.stringify(result.body)}`); checks.push({ caso, estado: status }); console.log(`OK · ${caso} · HTTP ${status}`); };
  try {
    const people = [];
    for (const role of ["seller", "seller", "buyer", "buyer"]) {
      const data = { email: `prueba-orders-${randomUUID()}@example.invalid`, password: `Prueba-${randomUUID()}`, name: `Prueba Orders ${role}`, role };
      emails.add(data.email);
      const created = await request("POST", "/users/register", data); assert.equal(created.status, 200); users.add(created.body.userId);
      const login = await request("POST", "/users/login", { email: data.email, password: data.password }); assert.equal(login.status, 200); tokens.add(login.body.refreshToken);
      people.push({ id: created.body.userId, access: login.body.accessToken });
    }
    const [seller, otherSeller, buyer, otherBuyer] = people;
    const productIds = [];
    for (const [index, price] of [150, 80].entries()) {
      const product = await request("POST", "/products/create", { name: `Producto sintético Orders ${index}`, description: "Dato desechable de pruebas automatizadas de Orders", price, stock: 30 }, seller.access);
      assert.equal(product.status, 201); products.add(product.body.productId); productIds.push(product.body.productId);
    }
    const [p1, p2] = productIds;
    const data = { items: [{ productId: p1, quantity: 2, price: 0.01 }, { productId: p2, quantity: 1 }], total: 0.01, userId: otherBuyer.id };
    for (const [method, path] of [["POST", "/orders/create"], ["GET", "/orders/missing"], ["GET", `/orders/list/users/${buyer.id}`], ["POST", "/orders/missing/confirm"], ["POST", "/orders/missing/cancel"]]) check(`Autenticación obligatoria ${method} ${path.replace(buyer.id, "{userId}")}`, await request(method, path, method === "POST" ? data : undefined), 401);
    check("Token inválido", await request("POST", "/orders/create", data, "invalid-jwt"), 401);
    for (const [label, body] of [["JSON inválido", "{"], ["Sin ítems", {}], ["Arreglo vacío", { items: [] }], ["Ítem nulo", { items: [null] }], ["Sin productId", { items: [{ quantity: 1 }] }], ["Cantidad cero", { items: [{ productId: p1, quantity: 0 }] }], ["Cantidad negativa", { items: [{ productId: p1, quantity: -2 }] }], ["Cantidad fraccionaria", { items: [{ productId: p1, quantity: 1.5 }] }], ["Cantidad en texto", { items: [{ productId: p1, quantity: "1" }] }]]) check(label, await request("POST", "/orders/create", body, buyer.access), 400);
    check("Producto inexistente", await request("POST", "/orders/create", { items: [{ productId: randomUUID(), quantity: 1 }] }, buyer.access), 400);
    check("Stock insuficiente", await request("POST", "/orders/create", { items: [{ productId: p1, quantity: 31 }] }, buyer.access), 400);
    check("Cantidades repetidas se suman antes de validar stock", await request("POST", "/orders/create", { items: [{ productId: p1, quantity: 20 }, { productId: p1, quantity: 20 }] }, buyer.access), 400);
    const first = await request("POST", "/orders/create", data, buyer.access); check("Crear orden con dos productos mediante invocación Lambda", first, 201); orders.add(first.body.orderId);
    assert.equal(first.body.userId, buyer.id); assert.equal(first.body.total, 380); assert.equal(first.body.status, "pending"); assert.equal(first.body.items[0].price, 150);
    checks.push({ caso: "Identidad y precio provienen del servidor; se ignoran campos falsificados del cliente", estado: 201 });
    const stock1 = await request("GET", `/products/${p1}`), stock2 = await request("GET", `/products/${p2}`); assert.equal(stock1.body.stock, 28); assert.equal(stock2.body.stock, 29); checks.push({ caso: "Stock reservado en ambas lambdas Products", estado: 200 });
    const id = first.body.orderId;
    const found = await request("GET", `/orders/${id}`, undefined, buyer.access); check("Consultar la orden propia", found, 200); assert.equal(found.body.order.orderId, id);
    check("Consultar una orden ajena bloqueado", await request("GET", `/orders/${id}`, undefined, otherBuyer.access), 403);
    check("Orden inexistente", await request("GET", `/orders/${randomUUID()}`, undefined, buyer.access), 404);
    const list = await request("GET", `/orders/list/users/${buyer.id}`, undefined, buyer.access); check("Listar órdenes propias", list, 200); assert.equal(list.body.orders.length, 1);
    check("Listar órdenes ajenas bloqueado", await request("GET", `/orders/list/users/${buyer.id}`, undefined, otherBuyer.access), 403);
    const empty = await request("GET", `/orders/list/users/${otherBuyer.id}`, undefined, otherBuyer.access); check("Usuario sin órdenes", empty, 200); assert.deepEqual(empty.body.orders, []);
    check("Comprador no puede confirmar", await request("POST", `/orders/${id}/confirm`, undefined, buyer.access), 403);
    check("Vendedor ajeno no puede confirmar", await request("POST", `/orders/${id}/confirm`, undefined, otherSeller.access), 403);
    check("Vendedor ajeno no puede cancelar", await request("POST", `/orders/${id}/cancel`, undefined, otherSeller.access), 403);
    check("Comprador ajeno no puede cancelar", await request("POST", `/orders/${id}/cancel`, undefined, otherBuyer.access), 403);
    const confirmed = await request("POST", `/orders/${id}/confirm`, undefined, seller.access); check("Vendedor participante confirma", confirmed, 200); assert.equal(confirmed.body.order.status, "confirmed");
    check("Confirmación repetida bloqueada", await request("POST", `/orders/${id}/confirm`, undefined, seller.access), 400);
    check("No cancelar una orden confirmada", await request("POST", `/orders/${id}/cancel`, undefined, buyer.access), 400);
    const freshPrice = await request("PUT", `/products/${p1}`, { price: 175 }, seller.access); assert.equal(freshPrice.status, 200);
    const snapshot = await request("GET", `/orders/${id}`, undefined, buyer.access); assert.equal(snapshot.body.order.items[0].price, 150); assert.equal(snapshot.body.order.total, 380); checks.push({ caso: "El cambio posterior de precio no altera la orden existente", estado: 200 });
    const create = async () => { const response = await request("POST", "/orders/create", { items: [{ productId: p1, quantity: 1 }] }, buyer.access); assert.equal(response.status, 201, JSON.stringify(response.body)); orders.add(response.body.orderId); return response.body.orderId; };
    const cancelId = await create();
    const canceled = await request("POST", `/orders/${cancelId}/cancel`, undefined, buyer.access); check("Comprador cancela su orden pending", canceled, 200); assert.equal(canceled.body.order.status, "canceled");
    check("Cancelación repetida bloqueada", await request("POST", `/orders/${cancelId}/cancel`, undefined, buyer.access), 400);
    check("No confirmar una orden cancelada", await request("POST", `/orders/${cancelId}/confirm`, undefined, seller.access), 400);
    const sellerCancelId = await create(); check("Vendedor participante cancela", await request("POST", `/orders/${sellerCancelId}/cancel`, undefined, seller.access), 200);
    const raceId = await create();
    const concurrent = await Promise.all([request("POST", `/orders/${raceId}/confirm`, undefined, seller.access), request("POST", `/orders/${raceId}/cancel`, undefined, buyer.access)]);
    assert.deepEqual(concurrent.map(x => x.status).sort(), [200, 400]); checks.push({ caso: "Confirmación y cancelación simultáneas: solo una transición gana", estado: 200 });
    const finalList = await request("GET", `/orders/list/users/${buyer.id}`, undefined, buyer.access); assert.equal(finalList.body.orders.length, 4); assert.ok(finalList.body.orders.every(x => x.userId === buyer.id)); assert.deepEqual(finalList.body.orders.map(x => x.createdAt), [...finalList.body.orders.map(x => x.createdAt)].sort().reverse()); checks.push({ caso: "Listado completo, exclusivo del usuario y con las órdenes recientes primero", estado: 200 });
    const stack = aws(["cloudformation", "describe-stacks", "--stack-name", "taller-orders-local"]).Stacks[0]; assert.match(stack.StackStatus, /^(CREATE|UPDATE)_COMPLETE$/);
    writeFileSync(resolve(__dirname, "../../../evidencias/10-orders/verificacion.json"), JSON.stringify({ stack: stack.StackName, estado: stack.StackStatus, pruebas: checks }, null, 2) + "\n");
    console.log(`${checks.length} comprobaciones completadas.`);
  } finally {
    // Un registro puede completarse aunque el cliente reciba un timeout.
    for (const email of emails) {
      const found = aws(["dynamodb", "query", "--table-name", "taller-users-local-users", "--index-name", "email-index", "--key-condition-expression", "email = :email", "--expression-attribute-values", JSON.stringify({ ":email": { S: email } })]).Items || [];
      for (const user of found) users.add(user.userId.S);
    }
    for (const [table, key, ids] of [["taller-orders-local-orders", "orderId", orders], ["taller-products-local-products", "productId", products], ["taller-users-local-users", "userId", users], ["taller-users-local-refresh-tokens", "token", tokens]]) {
      for (const id of ids) aws(["dynamodb", "delete-item", "--table-name", table, "--key", JSON.stringify({ [key]: { S: id } })]);
    }
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
