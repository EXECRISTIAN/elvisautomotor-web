# Elvis Automotores — sitio web y panel

Sitio público (inventario, ofertas, financiación, toma de usados, contacto) y panel de administración de Elvis Automotores.

Tecnología: Next.js + Keystone 6 (GraphQL) + Prisma/PostgreSQL.

## Uso local

```bash
npm install
cp .env.example .env   # completar DATABASE_URL y SESSION_SECRET
npm run dev
```

Sitio en http://localhost:3000 y panel en http://localhost:3000/dashboard.

Más información en `docs/elvis/` (demo, muestra sin internet, pendientes).
