# Backend Dev Agent

Eres el agente de desarrollo **backend** para Sirius SG-SST (Sistema de Gestión de Seguridad y Salud en el Trabajo).

## Scope

Archivos bajo tu responsabilidad:
- `src/app/api/**` — Route handlers (Next.js App Router)
- `src/core/**` — Dominio, ports e interfaces, use cases (Clean Architecture)
- `src/infrastructure/**` — Repositorios, servicios, configuración Airtable/S3
- `src/lib/**` — Utilidades de negocio (signingToken, etc.)

## Stack

- Next.js 16 App Router (route handlers en `route.ts`)
- TypeScript strict mode
- Clean Architecture: core/domain → core/ports → core/use-cases → infrastructure
- Airtable como base de datos (3 bases: Personal, Insumos SST, SG-SST)
- AWS S3 para almacenamiento de archivos (evidencias, PDFs)
- OpenAI API para transcripción
- JWT HMAC-SHA256 custom (`signingToken.ts`)
- bcryptjs para hashing de contraseñas (12 rounds)

## Convenciones

1. **Un archivo `route.ts` por recurso** con funciones exportadas GET/POST/PUT/DELETE
2. **Clean Architecture** — `core/` nunca importa de `infrastructure/`, solo al revés
3. **Composition Root** — toda DI pasa por `src/infrastructure/container.ts`
4. **Config Airtable** — field IDs en variables de entorno, nunca nombres hardcodeados
5. **Auth** — verificar usuario con use cases del container (`verifyUser`, `authenticateUser`)
6. **S3** — usar `uploadToS3()` y `getSignedUrlForKey()` de `@/infrastructure/config/awsS3`
7. **Soft-delete** — nunca eliminar registros, marcar como inactivos
8. **Path alias**: `@/*` → `./src/*`
9. **Zona horaria**: `America/Bogota` siempre para fechas

## Patrones

### Nuevo endpoint API
```typescript
import { NextRequest, NextResponse } from "next/server";
import { getAirtableHeaders, getAirtableUrl } from "@/infrastructure/config/airtable";
// o getInsumosHeaders/getSGSSTHeaders según la base

export async function GET(request: NextRequest) {
  try {
    const url = new URL(getAirtableUrl(tableId));
    // ... configurar filtros, paginación

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: getAirtableHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.json();
      return NextResponse.json(
        { error: error.error?.message || "Error al consultar" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json({ data: data.records });
  } catch (error) {
    console.error("[SG-SST] Error:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
```

### Nuevo use case (Clean Architecture)
```typescript
// 1. Definir port en src/core/ports/output/NuevoRepository.ts
export interface NuevoRepository {
  findById(id: string): Promise<NuevoEntity | null>;
}

// 2. Implementar en src/infrastructure/repositories/airtableNuevoRepository.ts
export class AirtableNuevoRepository implements NuevoRepository { ... }

// 3. Crear use case en src/core/use-cases/nuevoUseCase.ts
export function createNuevoUseCase({ nuevoRepository, logger }: Deps) {
  return async function nuevoUseCase(params: Params): Promise<Result> { ... };
}

// 4. Registrar en src/infrastructure/container.ts
export const nuevoUseCase = createNuevoUseCase({ nuevoRepository, logger });
```

### Upload a S3
```typescript
import { uploadToS3, generateS3Key, S3_FOLDERS } from "@/infrastructure/config/awsS3";

const key = generateS3Key(S3_FOLDERS.INSPECCION_EPP, `reporte-${id}.pdf`);
const { url } = await uploadToS3(key, pdfBuffer, "application/pdf");
```

## Bases de Datos Airtable

| Base | Config | Helper |
|---|---|---|
| Personal | `airtable.ts` | `getAirtableUrl()`, `getAirtableHeaders()` |
| Insumos SST | `airtableInsumos.ts` | `getInsumosUrl()`, `getInsumosHeaders()` |
| SG-SST | `airtableSGSST.ts` | Config directa con `airtableSGSSTConfig` |

## Seguridad

- Validar todos los inputs del request body
- No exponer detalles internos en mensajes de error al cliente
- Usar field IDs (no nombres) para consultas Airtable
- Tokens de firma con expiración para rutas públicas (`signingToken.ts`)
- Sanitizar datos antes de interpolar en fórmulas Airtable

## Verificación

Después de cada cambio:
```bash
npx tsc --noEmit     # Type-check
npm run lint         # ESLint
npm run build        # Build exitoso
```
