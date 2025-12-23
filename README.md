# Marketplace Demo (Customer / Seller / Admin)

- **Customer-facing**: browse sản phẩm, giỏ hàng, checkout, đơn hàng, tracking, đánh giá...
- **Seller Center**: quản lý shop, sản phẩm, tồn kho, xử lý đơn hàng...
- **Admin Console**: quản trị user, duyệt seller, kiểm duyệt sản phẩm, giám sát đơn...

## 1) Chạy Backend (Express + Prisma + MySQL)

### Yêu cầu

- Docker + Docker Compose

### Chạy

```bash
cd be
docker compose up -d --build
```

Backend mặc định chạy: `http://localhost:8080`
Trong `docker-compose.yml` đã bật:

- `AUTO_DB_PUSH=true` → tự chạy `prisma db push` và `prisma/seed.js` khi container khởi động.

## 2) Chạy Frontend (Vite + React)

> Frontend **không dùng Tailwind** (đã bake CSS sẵn vào `src/styles/app.css`). Bạn chỉ cần `npm install` và chạy Vite.

```bash
cd fe
npm install
npm run dev
```

Frontend: `http://localhost:5173`

Vite đã proxy `/api` sang backend `http://localhost:8080`.

## 3) Tài khoản demo (đã seed)

| Role | Email | Password |
|---|---|---|
| Admin | <admin@shop.local> | Admin@123 |
| CS | <cs@shop.local> | Cs@12345 |
| Seller | <seller@shop.local> | Seller@123 |
| Customer | <customer@shop.local> | Customer@123 |

> Lưu ý: **Login API dùng key `username`** (có thể nhập *email hoặc username*).

Ví dụ Register:

```bash
curl -X POST http://localhost:8080/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"username":"ep123","email":"ep123@gmail.com","password":"Abc@12345","firstName":"EP"}'
```

Ví dụ Login:

```bash
curl -X POST http://localhost:8080/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"customer@shop.local","password":"Customer@123"}'
```

## 4) Route UI demo

- Public: `/`, `/products`, `/p/:slug`, `/cart`
- Customer (cần login): `/checkout`, `/orders`, `/orders/:code`, `/profile`
- Open shop (cần login): `/open-shop`
- Seller (role SELLER): `/seller`
- Admin/CS (role ADMIN/CS): `/admin`

## 5) API chính (tóm tắt)

### Auth

- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/auth/forgot-password`
- `POST /api/auth/reset-password`
- `POST /api/auth/seller/apply`

### Public

- `GET /api/public/home`
- `GET /api/public/categories`
- `GET /api/public/products?q=&category=&sort=&minPrice=&maxPrice=&minRating=`
- `GET /api/public/products/:slug`
- `GET /api/public/products/:productId/reviews`
- `GET /api/public/shops/:slug`

### Customer

- `GET/POST/PUT/DELETE /api/customer/addresses`
- `GET/POST/PATCH/DELETE /api/customer/cart/...`
- `POST /api/customer/checkout`
- `GET /api/customer/orders`
- `GET /api/customer/orders/:code`
- `GET /api/customer/orders/:code/tracking`
- `POST /api/customer/orders/:code/confirm-received`
- `POST /api/customer/orders/:code/cancel-request`
- `POST /api/customer/orders/:code/return-request`
- `POST /api/customer/orders/:code/dispute`
- Chat: `GET/POST /api/customer/orders/:code/chat`
- Reviews: `POST /api/customer/reviews/product/:productId`, `PUT/DELETE /api/customer/reviews/:id`, `POST /api/customer/reviews/:id/report`

### Seller

- Shop: `GET/PUT /api/seller/shop`
- Products: `GET/POST/PUT /api/seller/products`, `POST /api/seller/products/:id/visibility` (ACTIVE/HIDDEN/OOS)
- Orders: `GET /api/seller/orders`, `POST /api/seller/orders/:code/confirm`, `.../pack`, `.../create-shipment`
- Cancel/Return: `GET /api/seller/cancel-requests`, `.../cancel-approve`, `GET /api/seller/return-requests`, ...
- Analytics: `GET /api/seller/analytics/summary`

### Admin

- Users: `GET /api/admin/users`, `PUT /api/admin/users/:id/role`, `PUT /api/admin/users/:id/block`
- Sellers: `GET /api/admin/sellers`, `POST /api/admin/sellers/:userId/approve|reject`
- Categories: CRUD `/api/admin/categories`
- Products moderation: `GET /api/admin/products`, `PUT /api/admin/products/:id/status`
- Orders: `GET /api/admin/orders`, `POST /api/admin/orders/:code/force-cancel`
- Audit logs: `GET /api/admin/audit`

---
