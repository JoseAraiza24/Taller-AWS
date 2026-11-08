const assert = require("node:assert/strict");
const fs = require("node:fs");
const { resolve } = require("node:path");
const { gatewayBase } = require("./aws-local.cjs");

(async () => {
  const base = gatewayBase();
  const previous = JSON.parse(fs.readFileSync(resolve(__dirname, "../../taller-products/.env.evidencia.json"), "utf8"));
  const credentials = previous.credentials;
  const request = async (method, path, body, token) => {
    const response = await fetch(`${base}${path}`, { method, headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(90000) });
    return { status: response.status, body: await response.json() };
  };
  const login = await request("POST", "/users/login", { email: credentials.email, password: credentials.password });
  assert.equal(login.status, 200, "No fue posible iniciar sesión con el usuario de práctica existente");
  const seller = previous.seller, token = login.body.accessToken;
  const products = [];
  const privatePath = resolve(__dirname, "../.env.evidencia.json");
  const old = fs.existsSync(privatePath) ? JSON.parse(fs.readFileSync(privatePath, "utf8")) : null;
  for (const [index, data] of [
    { name: "Kit de práctica Amazon Lite", description: "Producto ficticio para las órdenes de la Tarea 10", price: 250, stock: 20 },
    { name: "Cuaderno del taller AWS", description: "Producto ficticio para las órdenes de la Tarea 10", price: 120, stock: 10 },
  ].entries()) {
    const existing = old?.products?.[index];
    let product;
    if (existing) {
      const found = await request("GET", `/products/${existing.productId}`);
      if (found.status === 200 && found.body.sellerId === seller.userId) product = found.body;
    }
    if (!product) {
      const created = await request("POST", "/products/create", data, token);
      assert.equal(created.status, 201, JSON.stringify(created.body)); product = created.body;
    }
    products.push(product);
  }
  const detail = { base, user: seller, accessToken: token, products };
  fs.writeFileSync(privatePath, JSON.stringify(detail, null, 2) + "\n", { mode: 0o600 }); fs.chmodSync(privatePath, 0o600);
  const group = "__folder_orders_10__";
  const definitions = [
    ["01 · Create order", "POST", "/orders/create", { items: [{ productId: products[0].productId, quantity: 2 }, { productId: products[1].productId, quantity: 1 }] }],
    ["02 · Get order", "GET", "/orders/{{ _.orders_order_id }}"],
    ["03 · List orders by user", "GET", `/orders/list/users/${seller.userId}`],
    ["04 · Confirm order", "POST", "/orders/{{ _.orders_order_id }}/confirm"],
    ["05 · Cancel order", "POST", "/orders/{{ _.orders_cancel_order_id }}/cancel"],
  ];
  const resources = [
    { _type: "workspace", _id: "__WORKSPACE_ID__", name: "Orders · Actividad 10", scope: "collection" },
    { _type: "request_group", _id: group, parentId: "__WORKSPACE_ID__", name: "10 · Orders · José Antonio Araiza Cortés", environment: { orders_token: token }, metaSortKey: -200 },
    ...definitions.map(([name, method, path, body], index) => ({ _type: "request", _id: `__request_orders_${index + 1}__`, parentId: group, name, method, url: `${base}${path}`, metaSortKey: index, headers: body ? [{ name: "Content-Type", value: "application/json" }] : [], body: body ? { mimeType: "application/json", text: JSON.stringify(body, null, 2) } : {}, authentication: { type: "bearer", token: "{{ _.orders_token }}", prefix: "Bearer" } })),
  ];
  const path = resolve(__dirname, "../.env.insomnia-orders.json");
  fs.writeFileSync(path, JSON.stringify({ _type: "export", __export_format: 4, __export_source: "taller-orders", resources }, null, 2) + "\n", { mode: 0o600 }); fs.chmodSync(path, 0o600);
  fs.writeFileSync(resolve(__dirname, "../../../evidencias/10-orders/productos-practica.json"), JSON.stringify({ usuario: seller, productos: products }, null, 2) + "\n");
  console.log("Cinco peticiones de Orders preparadas para importar en Insomnia. No se crearon órdenes de evidencia por este script.");
  console.log(`Usuario: ${seller.name} · ${seller.email} · seller (también puede crear órdenes, como permite el video 34).`);
  console.log("Productos propios para la actividad: Kit de práctica Amazon Lite (250) y Cuaderno del taller AWS (120).");
})().catch(error => { console.error(error.message); process.exitCode = 1; });
