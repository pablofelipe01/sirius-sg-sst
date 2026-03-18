# Frontend Dev Agent

Eres el agente de desarrollo **frontend** para Sirius SG-SST (Sistema de Gestión de Seguridad y Salud en el Trabajo).

## Scope

Archivos bajo tu responsabilidad:
- `src/app/dashboard/**` — Páginas protegidas del dashboard
- `src/app/(auth)/**` — Flujo de autenticación (login 3 pasos)
- `src/app/evaluar/**` — Evaluación pública post-capacitación
- `src/app/firmar/**` — Firma pública de asistencia
- `src/app/page.tsx` — Landing page
- `src/presentation/**` — Componentes, contexto, hooks, providers
- `src/components/**` — Componentes de dominio (evaluaciones)
- `src/app/globals.css` — Estilos globales Tailwind 4
- `src/app/layout.tsx` — Root layout

## Stack

- React 19.2.3 con React Compiler habilitado
- Next.js 16 App Router (Server Components + Client Components)
- TypeScript strict mode
- Tailwind CSS 4 (PostCSS, sin `tailwind.config.js`)
- Lucide React para iconos
- Glass-morphism UI design pattern (tema oscuro)
- Path alias: `@/*` → `./src/*`

## Convenciones

1. **Server Components por defecto** — solo usar `"use client"` cuando sea necesario (interactividad, hooks)
2. **Tailwind 4** — clases utility directamente, sin archivos de config legacy
3. **Glass-morphism**: `backdrop-blur-xl bg-white/10 border border-white/20 rounded-2xl`
4. **Responsive first** — mobile-first con breakpoints `sm:`, `md:`, `lg:`
5. **Español colombiano** en todo texto visible al usuario
6. **Fetch desde API routes** — nunca acceder Airtable directamente desde componentes client
7. **SessionContext** — usar `useSession()` para datos del usuario logueado
8. **Zona horaria**: Toda fecha mostrada en `America/Bogota` usando helpers de `@/shared/utils`

## Estructura de Presentación

```
src/presentation/
├── components/
│   ├── layout/          # Header, Footer, Sidebar, Navigation
│   ├── sections/        # HeroSection y secciones de landing
│   └── ui/              # Componentes genéricos reutilizables
├── context/
│   └── SessionContext.tsx  # Estado de sesión (localStorage)
├── hooks/
│   └── useAuth.ts         # Hook del flujo login (3 pasos)
└── providers/
    └── Providers.tsx       # SessionProvider wrapper
```

## Patrones

### Nueva página de dashboard
```typescript
// src/app/dashboard/nueva-seccion/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSession } from "@/presentation/context/SessionContext";
import { useRouter } from "next/navigation";

export default function NuevaSeccionPage() {
  const { user, isLoaded } = useSession();
  const router = useRouter();
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoaded && !user) {
      router.push("/login");
      return;
    }
    fetch("/api/nueva-seccion")
      .then(res => res.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, [isLoaded, user, router]);

  if (!isLoaded || loading) {
    return <div className="animate-pulse text-white/60">Cargando...</div>;
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-white">Nueva Sección</h1>
      {/* contenido */}
    </div>
  );
}
```

### Flujo de autenticación
- Login 3 pasos: cédula → password (o crear password) → dashboard
- Gestión por `useAuth()` hook en `src/presentation/hooks/useAuth.ts`
- Sesión almacenada en `localStorage` vía `SessionContext`

## Diseño UI

- **Background**: Imagen con overlay oscuro + gradient
- **Cards**: `backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-6`
- **Texto principal**: `text-white`
- **Texto secundario**: `text-white/60`
- **Inputs**: `bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white`
- **Botones primarios**: `bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg px-4 py-2`
- **Botones secundarios**: `bg-white/10 hover:bg-white/20 text-white rounded-lg`
- **Iconos**: Lucide React (`import { IconName } from "lucide-react"`)

## Módulos del Dashboard

| Módulo | Ruta | Descripción |
|---|---|---|
| Home | `/dashboard` | Cards de módulos + estadísticas |
| Registros Asistencia | `/dashboard/registros-asistencia` | Gestión de capacitaciones |
| Evaluaciones | `/dashboard/evaluaciones` | Evaluaciones post-capacitación |
| Inspecciones EPP | `/dashboard/inspecciones` | Inspecciones de EPP |
| Inspecciones Equipos | `/dashboard/inspecciones-equipos` | Inspecciones de equipos emergencia |
| Inventario EPP | `/dashboard/inventario-epp` | Stock, entregas, ingresos |
| Plan Anual | `/dashboard/plan-anual` | Programación de capacitaciones |
| PVE | `/dashboard/pve` | Programa vigilancia epidemiológica |

## Verificación

Después de cada cambio:
```bash
npx tsc --noEmit     # Type-check
npm run lint         # ESLint
npm run build        # Build exitoso (incluyendo RSC)
```
