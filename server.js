const express = require("express");
const http = require("http");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "CHINNU";
const DATA_DIR = path.join(__dirname, "data");
const ORDERS_FILE = path.join(DATA_DIR, "orders.json");

fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(ORDERS_FILE)) fs.writeFileSync(ORDERS_FILE, "[]");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

const sessions = new Set();

const PRODUCTS = {
  dum: { name: "Chicken Dum Biryani", price: 120 },
  plain: { name: "Plain Biryani Rice", price: 90 },
  fry: { name: "Fry Piece Biryani", price: 170 }
};

function readOrders() {
  try { return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8")); }
  catch { return []; }
}

function saveOrders(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function clean(value, max = 120) {
  return String(value ?? "").trim().slice(0, max);
}

function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.get("/api/products", (req, res) => {
  res.json(PRODUCTS);
});

app.post("/api/orders", (req, res) => {
  const name = clean(req.body.name, 80);
  const phone = clean(req.body.phone, 30);
  const room = clean(req.body.room, 60);
  const incoming = Array.isArray(req.body.items) ? req.body.items : [];

  if (!name || !/^\d{10}$/.test(phone) || !room || !incoming.length) {
    return res.status(400).json({ error: "Please enter name, valid 10-digit phone, room number and add food." });
  }

  const items = [];
  for (const raw of incoming) {
    const itemKey = clean(raw && raw.id, 20);
    const quantity = Math.max(0, Math.min(20, Math.floor(Number(raw && raw.quantity) || 0)));
    if (!PRODUCTS[itemKey] || quantity < 1) continue;
    const product = PRODUCTS[itemKey];
    items.push({ name: product.name, itemKey, quantity, price: product.price });
  }
  if (!items.length) return res.status(400).json({ error: "Cart is empty." });

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const order = {
    id: "SS-" + Date.now().toString(36).toUpperCase() + "-" + crypto.randomBytes(2).toString("hex").toUpperCase(),
    name, phone, room, items, total,
    status: "New",
    createdAt: new Date().toISOString()
  };

  const orders = readOrders();
  orders.unshift(order);
  saveOrders(orders);
  io.emit("new-order", order);
  res.status(201).json({ ok: true, order });
});

app.post("/api/admin/login", (req, res) => {
  const password = String(req.body.password || "");
  if (password !== ADMIN_PASSWORD) return res.status(401).json({ error: "Wrong password" });

  const token = crypto.randomBytes(24).toString("hex");
  sessions.add(token);
  res.json({ token });
});

app.get("/api/orders", auth, (req, res) => {
  res.json(readOrders());
});

app.patch("/api/orders/:id", auth, (req, res) => {
  const allowed = ["New", "Preparing", "Delivered"];
  const status = clean(req.body.status, 20);
  if (!allowed.includes(status)) return res.status(400).json({ error: "Invalid status" });

  const orders = readOrders();
  const index = orders.findIndex(o => o.id === req.params.id);
  if (index === -1) return res.status(404).json({ error: "Order not found" });

  orders[index].status = status;
  orders[index].updatedAt = new Date().toISOString();
  saveOrders(orders);
  io.emit("order-updated", orders[index]);

  res.json({ ok: true, order: orders[index] });
});

app.delete("/api/orders/:id", auth, (req, res) => {
  const orders = readOrders();
  const next = orders.filter(o => o.id !== req.params.id);
  if (next.length === orders.length) return res.status(404).json({ error: "Order not found" });
  saveOrders(next);
  io.emit("order-deleted", req.params.id);
  res.json({ ok: true });
});

app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

server.listen(PORT, () => {
  console.log(`Spicy Spot running at http://localhost:${PORT}`);
  console.log(`Admin dashboard: http://localhost:${PORT}/admin`);
});
