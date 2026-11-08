const assert = require("node:assert/strict");
const fs = require("node:fs");
const { resolve } = require("node:path");
const { aws, gatewayBase } = require("./aws-local.cjs");

(async () => {
  const base = gatewayBase();
  const original = JSON.parse(fs.readFileSync(resolve(__dirname, "../../taller-users/.env.practica.json"), "utf8"));
  const credentials = { email: original.email, password: original.password, name: original.name, role: "seller" };
  const post = async (path, body) => { const r = await fetch(`${base}${path}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };
  const existing = aws(["dynamodb", "query", "--table-name", "taller-users-local-users", "--index-name", "email-index", "--key-condition-expression", "email = :email", "--expression-attribute-values", JSON.stringify({ ":email": { S: credentials.email } })]).Items || [];
  let seller;
  if (!existing.length) {
    const created = await post("/users/register", credentials); assert.equal(created.status, 200, JSON.stringify(created.body)); seller = created.body;
  } else {
    assert.equal(existing[0].role.S, "seller", "El correo ya existe con otro rol; no se modifica el usuario existente.");
    seller = { userId: existing[0].userId.S, email: existing[0].email.S, name: existing[0].name.S, role: existing[0].role.S };
  }
  const login = await post("/users/login", { email: credentials.email, password: credentials.password }); assert.equal(login.status, 200);
  const privatePath = resolve(__dirname, "../.env.evidencia.json");
  const details = { base, seller, accessToken: login.body.accessToken, refreshToken: login.body.refreshToken, credentials };
  fs.writeFileSync(privatePath, JSON.stringify(details, null, 2) + "\n", { mode: 0o600 }); fs.chmodSync(privatePath, 0o600);
  const groupId = "__folder_products_9__";
  const folderEnvironment = { products_base_url: base, products_seller_id: seller.userId, products_seller_token: login.body.accessToken };
  const createBody = { name: "Patineta de práctica", description: "Producto ficticio y desechable para la Tarea 9 del taller AWS", price: 1500, stock: 10 };
  const updateBody = { name: "Patineta de práctica - edición taller", description: "Producto ficticio actualizado para la Tarea 9", price: 1750, stock: 15 };
  const definitions = [
    ["01 · Create product", "POST", "/products/create", true, createBody],
    ["02 · Get product", "GET", "/products/{{ _.products_product_id }}", false],
    ["03 · Update product", "PUT", "/products/{{ _.products_product_id }}", true, updateBody],
    ["04 · List all products", "GET", "/products", false],
    ["05 · List products by seller", "GET", "/products/users/{{ _.products_seller_id }}", false],
    ["06 · Update stock", "PATCH", "/products/{{ _.products_product_id }}/stock", true, { quantity: 3 }],
    ["07 · Delete product", "DELETE", "/products/{{ _.products_product_id }}", true],
  ];
  const resources = [
    { _type: "workspace", _id: "__WORKSPACE_ID__", name: "Products · Actividad 9", scope: "collection", description: "Prácticas locales de Amazon Lite" },
    { _type: "request_group", _id: groupId, parentId: "__WORKSPACE_ID__", name: "09 · Products", environment: folderEnvironment, metaSortKey: -100 },
  ];
  definitions.forEach(([name, method, path, auth, body], index) => {
    const request = { _type: "request", _id: `__request_products_${index+1}__`, parentId: groupId, name, method, url: `{{ _.products_base_url }}${path}`, metaSortKey: index, headers: body ? [{ name: "Content-Type", value: "application/json" }] : [], body: body ? { mimeType: "application/json", text: JSON.stringify(body, null, 2) } : {}, authentication: auth ? { type: "bearer", token: "{{ _.products_seller_token }}", prefix: "Bearer" } : { type: "none" } };
    resources.push(request);
  });
  const path = resolve(__dirname, "../.env.insomnia-products.json");
  fs.writeFileSync(path, JSON.stringify({ _type: "export", __export_format: 4, __export_source: "taller-products", resources }, null, 2) + "\n", { mode: 0o600 }); fs.chmodSync(path, 0o600);
  fs.writeFileSync(resolve(__dirname, "../../../evidencias/09-products/vendedor.json"), JSON.stringify(seller, null, 2) + "\n");
  console.log("Vendedor local preparado y siete peticiones de Products guardadas para importar en Insomnia.");
  console.log(`Vendedor: ${seller.name} · ${seller.email} · role seller`);
})().catch((error) => { console.error(error.message); process.exitCode = 1; });
