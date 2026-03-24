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
│   │   │   ├── enviar-link/
│   │   │   ├── exportar/
│   │   │   ├── firmar/
│   │   │   ├── firmar-directo/
│   │   │   ├── firmar-publico/
│   │   │   ├── historial/
│   │   │   ├── regenerar-token/
│   │   │   └── token/validar/
│   │   ├── equipos-emergencia/      # Catálogo equipos emergencia
│   │   │   ├── route.ts
│   │   │   └── migrar/              # Migración de datos
│   │   ├── evaluaciones/            # Evaluaciones post-capacitación
│   │   │   ├── check-batch/
│   │   │   ├── lista-evento/
│   │   │   ├── pendientes/
│   │   │   ├── plantilla/[id]/
│   │   │   ├── responder/
│   │   │   ├── resultado-pdf/
│   │   │   └── resultado-pdf-unificado/
│   │   ├── inspecciones-areas/      # Inspecciones de áreas físicas ⭐ NUEVO
│   │   │   ├── route.ts
│   │   │   ├── [id]/
│   │   │   ├── descifrar/
│   │   │   ├── exportar/
│   │   │   └── exportar-pdf/
│   │   ├── inspecciones-botiquin/   # Inspecciones de botiquines ⭐ NUEVO
│   │   │   └── route.ts
│   │   ├── inspecciones-camilla/    # Inspecciones de camillas ⭐ NUEVO
│   │   │   └── route.ts
│   │   ├── inspecciones-epp/        # Inspecciones EPP
│   │   │   ├── route.ts
│   │   │   ├── [id]/
│   │   │   ├── descifrar/
│   │   │   └── exportar/
│   │   │       └── [id]/
│   │   ├── inspecciones-equipos/    # Inspecciones equipos emergencia
│   │   │   ├── route.ts
│   │   │   └── [id]/
│   │   ├── inspecciones-extintor/   # Inspecciones de extintores ⭐ NUEVO
│   │   │   └── route.ts
│   │   ├── inspecciones-kit-derrames/ # Inspecciones kits derrames ⭐ NUEVO
│   │   │   └── route.ts
│   │   ├── insumos/                 # Inventario (EPP + movimientos)
│   │   │   ├── epp/
│   │   │   └── movimientos/
│   │   ├── personal/                # Personal + validación
│   │   │   ├── route.ts
│   │   │   └── validar/
│   │   ├── programacion-capacitaciones/ # Programación anual
│   │   ├── registros-asistencia/    # Asistencia + evaluaciones + firma
│   │   │   ├── route.ts
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
│   │   ├── inspecciones/            # Hub de inspecciones
│   │   ├── inspecciones-areas/      # Inspecciones áreas ⭐ NUEVO
│   │   │   ├── page.tsx
│   │   │   ├── historial/
│   │   │   └── [id]/
│   │   ├── inspecciones-emergencia/ # Hub inspecciones emergencia ⭐ NUEVO
│   │   │   ├── page.tsx
│   │   │   └── historial/
│   │   ├── inspecciones-equipos/
│   │   │   ├── page.tsx
│   │   │   └── historial/
│   │   ├── inventario-epp/
│   │   │   ├── page.tsx             # Dashboard inventario
│   │   │   ├── entrega/
│   │   │   ├── entregas/
│   │   │   ├── historial/
│   │   │   ├── ingreso/
│   │   │   └── inspeccion/
│   │   │       ├── page.tsx
│   │   │       └── historial/
│   │   ├── plan-anual/
│   │   ├── pve/
│   │   └── registros-asistencia/
│   │       ├── page.tsx
│   │       ├── evaluaciones/
│   │       ├── historial/
│   │       └── nuevo/
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
| **SG-SST** | `airtableSGSST.ts` | 50+ tablas (ver detalles abajo) |

### Tablas en Base SG-SST (airtableSGSST.ts - 653 líneas)

**Entregas EPP:**
- Entregas EPP (cabecera)
- Detalle Entrega EPP
- Tokens Entrega
- Historial EPP Empleado

**Inspecciones EPP:**
- Inspecciones EPP (cabecera)
- Detalle Inspección EPP

**Inspecciones de Áreas:**
- Inspecciones Áreas (cabecera)
- Detalle Inspección Áreas (criterios)
- Responsables Inspección Áreas
- Acciones Correctivas Áreas

**Inspecciones de Equipos de Emergencia:**
- Equipos Emergencia (catálogo maestro)
- Inspecciones Equipos Emergencia (cabecera)
- Detalle Inspección Equipos
- Responsables Inspección Equipos

**Inspecciones Específicas (4 tipos):**
- Inspecciones Botiquín + Detalle + Responsables + Catálogo Botiquines + Catálogo Elementos
- Inspecciones Extintor + Detalle + Responsables + Catálogo Extintores
- Inspecciones Camilla + Detalle + Responsables + Catálogo Camillas + Catálogo Elementos
- Inspecciones Kit Derrames + Detalle + Verificaciones + Responsables + Catálogo Kits + Catálogo Elementos

**Capacitaciones:**
- Capacitaciones (catálogo de temas)
- Programación Capacitaciones (plan mensual)
- Eventos Capacitación (sesiones reales)
- Asistencia Capacitaciones (detalle asistentes)

**Evaluaciones:**
- Banco de Preguntas
- Plantillas Evaluación
- Preguntas por Plantilla
- Evaluaciones Aplicadas
- Respuestas Evaluación

**Comités SST:**
- Miembros Comités SST

## Módulos del Sistema

### Módulos Core (Completados)

| Módulo | API | Dashboard | Estado |
|---|---|---|---|
| **Capacitaciones** | `/api/capacitaciones` | `registros-asistencia` | ✅ |
| **Registros Asistencia** | `/api/registros-asistencia` | `registros-asistencia` | ✅ |
| **Evaluaciones** | `/api/evaluaciones` | `evaluaciones` | ✅ |
| **Entregas EPP** | `/api/entregas-epp` | `inventario-epp/entrega` | ✅ |
| **Inventario EPP** | `/api/insumos` | `inventario-epp` | ✅ |
| **Plan Anual** | `/api/programacion-capacitaciones` | `plan-anual` | ✅ |

### Módulos de Inspecciones (Completados)

| Módulo | API | Dashboard | Estado | Detalles |
|---|---|---|---|---|
| **Inspecciones EPP** | `/api/inspecciones-epp` | `inventario-epp/inspeccion` | ✅ | 9 criterios EPP + firma + exportar |
| **Inspecciones Equipos** | `/api/inspecciones-equipos` | `inspecciones-equipos` | ✅ | Equipos emergencia genérico |
| **Inspecciones Áreas** | `/api/inspecciones-areas` | `inspecciones-areas` | ✅ | Categorías + criterios + acciones correctivas |

### Módulos de Inspecciones Específicas (Nuevos - Mar 2026)

| Módulo | API | Dashboard | Estado | Características |
|---|---|---|---|---|
| **Inspecciones Botiquín** | `/api/inspecciones-botiquin` | `inspecciones-emergencia` | 🚧 | Catálogo elementos + vencimientos |
| **Inspecciones Extintor** | `/api/inspecciones-extintor` | `inspecciones-emergencia` | 🚧 | 10 criterios específicos |
| **Inspecciones Camilla** | `/api/inspecciones-camilla` | `inspecciones-emergencia` | 🚧 | Elementos + estado |
| **Inspecciones Kit Derrames** | `/api/inspecciones-kit-derrames` | `inspecciones-emergencia` | 🚧 | Elementos + verificaciones procedimiento |

### Módulos en Desarrollo

| Módulo | API | Dashboard | Estado |
|---|---|---|---|
| **PVE Osteomuscular** | — | `pve` | 🔧 |
| **Gestión de Riesgos** | — | — | 📋 Planificado |
| **Incidentes y Accidentes** | — | — | 📋 Planificado |
| **Exámenes Médicos** | — | — | 📋 Planificado |
| **Documentación SST** | — | — | 📋 Planificado |

**Leyenda:**
- ✅ Completado y funcional
- 🚧 API implementada, UI en desarrollo
- 🔧 En construcción
- 📋 Planificado

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

Ver archivo `.env.example` para la lista completa. Resumen de variables principales:

### Base Personal (airtable.ts)
```bash
AIRTABLE_API_TOKEN           # Token de acceso a Airtable
AIRTABLE_BASE_ID             # ID de la base Personal
AIRTABLE_PERSONAL_TABLE_ID   # ID tabla Personal
AIRTABLE_SISTEMAS_TABLE_ID   # ID tabla Sistemas
AIRTABLE_ROLES_TABLE_ID      # ID tabla Roles (si existe)
AIRTABLE_PF_*                # Field IDs de Personal (15+ variables)
```

### Base Insumos SST (airtableInsumos.ts)
```bash
AIRTABLE_INSUMOS_API_TOKEN   # Token para base Insumos
AIRTABLE_INSUMOS_BASE_ID     # ID de la base Insumos
AIRTABLE_INSUMO_TABLE_ID     # ID tabla Insumo
AIRTABLE_MOV_INSUMO_TABLE_ID # ID tabla Movimientos
AIRTABLE_STOCK_INSUMO_TABLE_ID # ID tabla Stock
# Field IDs: AIRTABLE_INS_*, AIRTABLE_MOV_*, AIRTABLE_STOCK_*
```

### Base SG-SST (airtableSGSST.ts)
```bash
AIRTABLE_SGSST_API_TOKEN     # Token para base SG-SST
AIRTABLE_SGSST_BASE_ID       # ID de la base SG-SST

# Table IDs (50+ tablas)
AIRTABLE_ENTREGAS_TABLE_ID   # Entregas EPP
AIRTABLE_INSP_TABLE_ID       # Inspecciones EPP
AIRTABLE_EQUIP_TABLE_ID      # Equipos Emergencia
AIRTABLE_INSPA_TABLE_ID      # Inspecciones Áreas
AIRTABLE_INSPBOT_TABLE_ID    # Inspecciones Botiquín
AIRTABLE_INSPEXT_TABLE_ID    # Inspecciones Extintor
AIRTABLE_INSPCAM_TABLE_ID    # Inspecciones Camilla
AIRTABLE_INSPKIT_TABLE_ID    # Inspecciones Kit Derrames
AIRTABLE_CAP_TABLE_ID        # Capacitaciones
AIRTABLE_PROG_TABLE_ID       # Programación Capacitaciones
AIRTABLE_EVT_TABLE_ID        # Eventos Capacitación
AIRTABLE_ASIS_TABLE_ID       # Asistencia
AIRTABLE_PRG_BANCO_TABLE_ID  # Banco Preguntas
AIRTABLE_PLNT_TABLE_ID       # Plantillas Evaluación
# + 35+ table IDs más (ver airtableSGSST.ts)

# Field IDs (300+ variables)
# Formato: AIRTABLE_[TABLA_ABREV]_[NOMBRE_CAMPO]
# Ejemplo: AIRTABLE_ENT_ID_ENTREGA, AIRTABLE_DETINSPA_CATEGORIA
# Ver airtableSGSST.ts líneas 1-653 para lista completa
```

### AWS S3
```bash
AWS_ACCESS_KEY_ID            # Clave de acceso AWS
AWS_SECRET_ACCESS_KEY        # Clave secreta AWS
AWS_REGION                   # Región (ej: us-east-1)
AWS_S3_BUCKET_NAME           # Nombre del bucket S3
```

### Autenticación y Seguridad
```bash
JWT_SECRET                   # Secreto para tokens JWT
# Opcional: NEXT_PUBLIC_* para variables del cliente
```

**IMPORTANTE:** Todas las variables de Field IDs deben estar definidas. El archivo `airtableSGSST.ts` tiene más de 300 field IDs configurados. Usar `.env.example` como plantilla.

## Estado del Proyecto (Actualizado 2026-03-24)

### Completitud General: 75%

**Funcional y en Producción:**
- Sistema de autenticación (3 pasos)
- Gestión de capacitaciones y asistencia
- Sistema de evaluaciones con banco de preguntas
- Entregas EPP con firma digital
- Inventario EPP completo
- Inspecciones EPP
- Inspecciones de áreas físicas (recientemente corregido)
- Inspecciones de equipos de emergencia
- Plan anual de capacitaciones
- Exportación a Excel y PDF

**En Desarrollo Activo:**
- 4 módulos de inspecciones específicas (API lista, UI pendiente):
  - Botiquines
  - Extintores
  - Camillas
  - Kits de derrames
- Dashboard unificado de inspecciones de emergencia

**Planificado:**
- Gestión de riesgos
- Módulo de incidentes y accidentes
- Control de exámenes médicos
- PVE Osteomuscular
- Gestión documental

### Deuda Técnica Conocida

**Prioridad ALTA:**
1. Optimización de queries en exportación Excel (inspecciones-areas)
   - Actualmente carga todas las tablas sin filtros
   - Puede causar timeouts en bases grandes
   - Ver: `DIAGNOSTICO_INSPECCIONES_AREAS.md`

2. Validación de Field IDs faltante
   - No hay validación de que los field IDs estén definidos
   - Fallas silenciosas si una variable está undefined
   - Recomendado: función `validateConfig()` en startup

3. Logging insuficiente
   - Errores de queries secundarias se ignoran silenciosamente
   - Dificulta debugging en producción

**Prioridad MEDIA:**
4. Falta ordenamiento explícito en queries Airtable
   - Los resultados no tienen orden predecible
   - Puede confundir a usuarios

5. Tests automatizados
   - No hay suite de tests
   - Todas las pruebas son manuales

6. Documentación de API endpoints
   - No hay documentación formal de endpoints
   - Solo código fuente como referencia

**Prioridad BAJA:**
7. UI de inspecciones específicas
   - APIs completadas pero sin interfaces
   - Funcionalidad accesible solo vía API

8. Migraciones de datos
   - Existe `/api/equipos-emergencia/migrar` pero no documentado
   - Proceso manual, no automatizado

### Mejoras Recientes (Marzo 2026)

- ✅ Corrección crítica en queries FIND() de inspecciones-areas
- ✅ Implementación de 4 APIs de inspecciones específicas
- ✅ Creación de hub de inspecciones de emergencia
- ✅ Endpoint de migración de equipos
- ✅ Mejoras en sistema de evaluaciones (validación de respuestas)

### Archivos de Diagnóstico

El proyecto incluye documentación de diagnósticos y fixes:
- `DIAGNOSTICO_INSPECCIONES_AREAS.md` - Problema de reportes vacíos (RESUELTO)
- `DIAGNOSTICO_EVALUACIONES.md` - Problemas de validación evaluaciones
- `ANALISIS_INSPECCIONES_AREAS.md` - Análisis técnico completo
- `IMPLEMENTACION_INSPECCIONES_AREAS.md` - Guía de implementación
- `FIX_VALIDACION_RESPUESTAS.md` - Fix de validación de respuestas
- `RESUMEN_FIX_EVALUACIONES.md` - Resumen de correcciones

## Reglas para Agentes de Desarrollo

1. **No romper lo existente** — siempre verificar con `npm run build` después de cambios
2. **Clean Architecture** — respetar la separación core → infrastructure → presentation
3. **No separar el monorepo** — todo vive bajo `src/` con App Router
4. **Seguridad primero** — validar inputs, respetar acceso por rol
5. **Español colombiano** — en UI, comentarios y documentación
6. **Minimal changes** — no refactorizar código que funciona sin pedido explícito
7. **Field IDs** — usar variables de entorno para IDs de campos Airtable, nunca nombres hardcodeados
8. **Container.ts** — toda inyección de dependencias pasa por el Composition Root
9. **FIND() en Airtable** — siempre usar `FIND(...) > 0` para comparación booleana explícita
10. **Logging** — loggear errores de queries secundarias para debugging
11. **Optimización** — filtrar en Airtable, no cargar todo y filtrar en memoria
