# CLAUDE.md — Sirius SG-SST

> Archivo leído automáticamente por Claude Code CLI en cada sesión. Documenta el proyecto para todos los agentes de desarrollo.

## Stack Tecnológico

- **Framework**: Next.js 16.1.6 con App Router (monorepo — sin separación backend/frontend)
- **React**: 19.2.3 con React Compiler habilitado
- **TypeScript**: 5.x (strict mode)
- **Estilos**: Tailwind CSS 4 con PostCSS, glass-morphism UI oscuro
- **Base de datos**: Airtable (3 bases: Personal, Insumos SST, SG-SST)
- **Almacenamiento**: AWS S3 (evidencias, reportes PDF, documentos)
- **AI**: OpenAI API (transcripción y asistencia)
- **Auth**: JWT HMAC-SHA256 custom (`signingToken.ts`), bcryptjs (12 rounds)
- **PDF**: jsPDF + jsPDF-AutoTable
- **Excel**: ExcelJS (exportar registros)
- **Iconos**: Lucide React
- **Arquitectura**: Clean Architecture (core/domain → core/ports → core/use-cases → infrastructure)

## Estructura del Monorepo

```
src/
├── app/
│   ├── api/                         # Backend — Route handlers (Next.js)
│   │   ├── auth/                    # Login, registro, verificación
│   │   │   ├── login/route.ts
│   │   │   ├── register/route.ts
│   │   │   └── verify/route.ts
│   │   ├── capacitaciones/          # Catálogo de capacitaciones
│   │   ├── entregas-epp/            # CRUD + firma + exportar entregas EPP
│   │   │   ├── route.ts
│   │   │   ├── descifrar/
│   │   │   ├── exportar/
│   │   │   └── firmar/
│   │   ├── equipos-emergencia/      # Catálogo equipos emergencia
│   │   ├── evaluaciones/            # Evaluaciones post-capacitación
│   │   │   ├── check-batch/
│   │   │   ├── lista-evento/
│   │   │   ├── pendientes/
│   │   │   ├── plantilla/
│   │   │   ├── responder/
│   │   │   ├── resultado-pdf/
│   │   │   └── resultado-pdf-unificado/
│   │   ├── inspecciones-epp/        # Inspecciones EPP
│   │   │   ├── route.ts
│   │   │   ├── [id]/
│   │   │   ├── descifrar/
│   │   │   └── exportar/
│   │   ├── inspecciones-equipos/    # Inspecciones equipos emergencia
│   │   ├── insumos/                 # Inventario (EPP + movimientos)
│   │   ├── personal/               # Personal + validación
│   │   ├── programacion-capacitaciones/ # Programación anual
│   │   ├── registros-asistencia/    # Asistencia + evaluaciones + firma
│   │   │   ├── route.ts
│   │   │   ├── [id]/
│   │   │   ├── evaluaciones-pdf/
│   │   │   ├── exportar/
│   │   │   ├── firmar/
│   │   │   ├── firmar-publico/
│   │   │   └── token/
│   │   └── transcribir/             # Transcripción audio → texto
│   ├── (auth)/                      # Layout autenticación
│   │   ├── layout.tsx
│   │   └── login/page.tsx
│   ├── dashboard/                   # Frontend — Páginas protegidas
│   │   ├── page.tsx                 # Home dashboard (módulos)
│   │   ├── evaluaciones/
│   │   ├── inspecciones/
│   │   ├── inspecciones-equipos/
│   │   ├── inventario-epp/
│   │   ├── plan-anual/
│   │   ├── pve/
│   │   └── registros-asistencia/
│   ├── evaluar/capacitacion/        # Evaluación pública
│   ├── firmar/capacitacion/         # Firma pública asistencia
│   ├── layout.tsx                   # Root layout
│   ├── page.tsx                     # Landing (Header + Hero)
│   └── globals.css                  # Tailwind 4
├── components/                      # Componentes de dominio
│   └── evaluaciones/
│       └── EvaluacionFlow.tsx
├── core/                            # 🏗 Clean Architecture — Dominio
│   ├── domain/
│   │   ├── entities/User.ts         # User, VerifyResponse, AuthResponse
│   │   ├── services/accessControl.ts
│   │   └── value-objects/
│   ├── ports/
│   │   ├── input/                   # (futuro: interfaces de entrada)
│   │   └── output/                  # PersonRepository, PasswordHasher, Logger
│   └── use-cases/
│       ├── authenticateUser.ts
│       ├── registerPassword.ts
│       └── verifyUser.ts
├── infrastructure/                  # 🔌 Implementaciones concretas
│   ├── container.ts                 # Composition Root (DI manual)
│   ├── adapters/                    # (futuro: adaptadores externos)
│   ├── config/
│   │   ├── airtable.ts             # Base Personal (config + helpers)
│   │   ├── airtableInsumos.ts      # Base Insumos SST
│   │   ├── airtableSGSST.ts        # Base SG-SST (entregas, inspecciones)
│   │   └── awsS3.ts                # S3 client + upload/signed URLs
│   ├── repositories/
│   │   └── airtablePersonalRepository.ts
│   └── services/
│       ├── BcryptPasswordHasher.ts
│       └── ConsoleLogger.ts
├── lib/
│   └── signingToken.ts             # JWT HMAC-SHA256 para firma remota
├── presentation/                   # 🎨 UI Layer
│   ├── components/
│   │   ├── layout/                 # Header, Footer, Sidebar
│   │   ├── sections/               # HeroSection, etc.
│   │   └── ui/                     # Componentes genéricos
│   ├── context/
│   │   └── SessionContext.tsx       # Estado de sesión (localStorage)
│   ├── hooks/
│   │   └── useAuth.ts              # Hook de autenticación (3 pasos)
│   └── providers/
│       └── Providers.tsx            # SessionProvider wrapper
└── shared/                         # 📦 Código compartido
    ├── constants/index.ts           # APP_NAME, ROUTES
    ├── types/index.ts               # ApiResponse, PaginatedResponse
    └── utils/index.ts               # cn(), formatFechaColombia(), etc.
```

## Convenciones

- **Idioma**: Español colombiano en UI, comentarios y mensajes
- **Path alias**: `@/*` → `./src/*`
- **API pattern**: GET/POST/PUT/DELETE en un solo `route.ts` por recurso
- **Auth**: Login 3 pasos (verificar → password/crear password → sesión)
- **Sesión**: `localStorage` con `SessionContext` + cookie JWT para API
- **Clean Architecture**: `core/` nunca importa de `infrastructure/`, solo al revés
- **Composition Root**: `infrastructure/container.ts` — único punto de DI
- **Config Airtable**: Field IDs en variables de entorno para independencia de nombres
- **S3 Storage**: Evidencias y PDFs se almacenan en S3 con URLs firmadas
- **Soft-delete**: Registros no se eliminan, se marcan inactivos
- **Zona horaria**: Siempre `America/Bogota` para fechas

## Bases de Datos Airtable

| Base | Config | Tablas principales |
|---|---|---|
| **Personal** | `airtable.ts` | Personal, Sistemas, Roles |
| **Insumos SST** | `airtableInsumos.ts` | Insumo, Categoría, Movimientos, Stock |
| **SG-SST** | `airtableSGSST.ts` | Entregas EPP, Detalle Entrega, Tokens, Historial EPP, Inspecciones EPP, Equipos Emergencia, Inspecciones Equipos |

## Módulos del Sistema

| Módulo | API | Dashboard | Estado |
|---|---|---|---|
| Capacitaciones | `/api/capacitaciones` | registros-asistencia | ✅ |
| Registros Asistencia | `/api/registros-asistencia` | registros-asistencia | ✅ |
| Evaluaciones | `/api/evaluaciones` | evaluaciones | ✅ |
| Entregas EPP | `/api/entregas-epp` | inventario-epp/entrega | ✅ |
| Inspecciones EPP | `/api/inspecciones-epp` | inspecciones | ✅ |
| Inspecciones Equipos | `/api/inspecciones-equipos` | inspecciones-equipos | ✅ |
| Inventario EPP | `/api/insumos` | inventario-epp | ✅ |
| Plan Anual | `/api/programacion-capacitaciones` | plan-anual | ✅ |
| PVE Osteomuscular | — | pve | 🔧 |

## Patrones Clave del Código

### Clean Architecture — Composition Root
```typescript
// src/infrastructure/container.ts
// Único punto donde infrastructure conoce a core
export const verifyUser = createVerifyUser({ personRepository, logger });
export const authenticateUser = createAuthenticateUser({ personRepository, passwordHasher, logger });
```

### Airtable Config con Field IDs
```typescript
// src/infrastructure/config/airtable.ts
// Fields referenciados por ID (no por nombre) → inmune a renombramientos
const PF = airtableConfig.personalFields;
const filterFormula = `{${PF.NUMERO_DOCUMENTO}} = '${value}'`;
```

### Token de Firma (HMAC-SHA256)
```typescript
// src/lib/signingToken.ts
const token = generateSigningToken(payload, secret, hoursValid);
const result = verifySigningToken(token, secret); // null si inválido
```

### S3 Upload
```typescript
// src/infrastructure/config/awsS3.ts
const { url, key } = await uploadToS3(s3Key, buffer, "application/pdf");
const signedUrl = await getSignedUrlForKey(key, 3600);
```

## Comandos

```bash
npm run dev        # Desarrollo
npm run build      # Build producción
npm run lint       # ESLint
npx tsc --noEmit   # Type-check sin emitir
```

## Variables de Entorno Requeridas

```
# Base Personal (airtable.ts)
AIRTABLE_API_TOKEN
AIRTABLE_BASE_ID
AIRTABLE_PERSONAL_TABLE_ID
AIRTABLE_SISTEMAS_TABLE_ID
AIRTABLE_ROLES_TABLE_ID
AIRTABLE_PF_*                # Field IDs de Personal

# Base Insumos (airtableInsumos.ts)
AIRTABLE_INSUMOS_API_TOKEN
AIRTABLE_INSUMOS_BASE_ID
AIRTABLE_INSUMO_TABLE_ID
AIRTABLE_MOV_INSUMO_TABLE_ID
AIRTABLE_STOCK_INSUMO_TABLE_ID

# Base SG-SST (airtableSGSST.ts)
AIRTABLE_SGSST_API_TOKEN
AIRTABLE_SGSST_BASE_ID
AIRTABLE_ENTREGAS_TABLE_ID
AIRTABLE_INSP_TABLE_ID
AIRTABLE_EQUIP_TABLE_ID

# AWS S3
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
AWS_S3_BUCKET_NAME

# Auth
JWT_SECRET                   # (si se usa para tokens)
```

## Reglas para Agentes de Desarrollo

1. **No romper lo existente** — siempre verificar con `npm run build` después de cambios
2. **Clean Architecture** — respetar la separación core → infrastructure → presentation
3. **No separar el monorepo** — todo vive bajo `src/` con App Router
4. **Seguridad primero** — validar inputs, respetar acceso por rol
5. **Español colombiano** — en UI, comentarios y documentación
6. **Minimal changes** — no refactorizar código que funciona sin pedido explícito
7. **Field IDs** — usar variables de entorno para IDs de campos Airtable, nunca nombres hardcodeados
8. **Container.ts** — toda inyección de dependencias pasa por el Composition Root
