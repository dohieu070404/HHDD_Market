
## Chạy dự án

```bash
npm install
npm run dev
```

Mặc định FE chạy: <http://localhost:5173>

## Kết nối Backend

FE gọi API theo base `/api` (Vite proxy sang backend mặc định <http://localhost:8080>)

- POST `/api/auth/register`
- POST `/api/auth/login`
- GET  `/api/auth/me` (Bearer token)
- POST `/api/auth/logout`
