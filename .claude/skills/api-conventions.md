# Skill: Convenciones de API — SG-SST

Conocimiento de dominio sobre las convenciones de API routes en Sirius SG-SST.

## Estructura de Endpoints

Next.js App Router: un archivo `route.ts` por recurso con funciones HTTP exportadas.

```
src/app/api/
├── auth/
│   ├── login/route.ts           # POST — Login con documento + password
│   ├── register/route.ts        # POST — Crear password (primer login)
│   └── verify/route.ts          # POST — Verificar existencia de usuario
├── capacitaciones/route.ts      # GET — Catálogo de capacitaciones
├── entregas-epp/
│   ├── route.ts                 # GET (listar), POST (crear entrega)
│   ├── descifrar/route.ts       # POST — Descifrar token de firma
│   ├── exportar/route.ts        # POST — Exportar PDF/Excel
│   └── firmar/route.ts          # POST — Firmar entrega remotamente
├── equipos-emergencia/route.ts  # GET — Catálogo equipos
├── evaluaciones/
│   ├── check-batch/route.ts     # POST — Verificar batch evaluaciones
│   ├── lista-evento/route.ts    # GET — Evaluaciones por evento
│   ├── pendientes/route.ts      # GET — Evaluaciones pendientes
│   ├── plantilla/route.ts       # GET — Plantilla de evaluación
│   ├── responder/route.ts       # POST — Enviar respuestas
│   ├── resultado-pdf/route.ts   # GET — PDF resultado individual
│   └── resultado-pdf-unificado/route.ts # GET — PDF resultado grupal
├── inspecciones-epp/
│   ├── route.ts                 # GET (listar), POST (crear)
│   ├── [id]/route.ts            # GET (detalle)
│   ├── descifrar/route.ts       # POST — Descifrar token
│   └── exportar/route.ts        # POST — Exportar reporte
├── inspecciones-equipos/
│   ├── route.ts                 # GET/POST
│   └── [id]/route.ts            # GET (detalle)
├── insumos/
│   ├── epp/route.ts             # GET — Insumos EPP
│   └── movimientos/route.ts     # GET/POST — Movimientos inventario
├── personal/
│   ├── route.ts                 # GET — Lista personal
│   └── validar/route.ts         # POST — Validar personal
├── programacion-capacitaciones/route.ts # GET/POST
├── registros-asistencia/
│   ├── route.ts                 # GET (listar), POST (crear evento)
│   ├── [id]/route.ts            # GET (detalle)
│   ├── evaluaciones-pdf/route.ts
│   ├── exportar/route.ts
│   ├── firmar/route.ts          # POST — Firmar asistencia
│   ├── firmar-publico/route.ts  # POST — Firma pública (sin login)
│   └── token/route.ts           # POST — Generar token de firma
└── transcribir/route.ts         # POST — Audio a texto (OpenAI)
```

## Patrón de Autenticación

La autenticación usa Clean Architecture con use cases en el container:

```typescript
// src/app/api/auth/verify/route.ts
import { verifyUser } from "@/infrastructure/container";

export async function POST(request: NextRequest) {
  const { numeroDocumento } = await request.json();
  const result = await verifyUser(numeroDocumento);
  return NextResponse.json(result);
}
```

```typescript
// src/app/api/auth/login/route.ts
import { authenticateUser } from "@/infrastructure/container";

export async function POST(request: NextRequest) {
  const { numeroDocumento, password } = await request.json();
  const result = await authenticateUser(numeroDocumento, password);
  return NextResponse.json(result);
}
```

## Flujo de Login (3 pasos)

```
1. POST /api/auth/verify   → { success, needsPassword, nombreCompleto }
   ↓ (si needsPassword=true)
2a. POST /api/auth/register → Crear password + auto-login
   ↓ (si needsPassword=false)
2b. POST /api/auth/login    → Verificar password + login
   ↓
3. SessionContext.login(user) → localStorage + redirect /dashboard
```

## Respuestas HTTP Estándar

### Éxito
```typescript
return NextResponse.json({ data: records, success: true });
```

### Creación
```typescript
return NextResponse.json({ success: true, eventoId: record.id }, { status: 201 });
```

### Error de validación
```typescript
return NextResponse.json({ error: "El campo X es requerido" }, { status: 400 });
```

### Error interno (NUNCA exponer detalles)
```typescript
return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
```

## Patrón de Endpoint con Airtable

```typescript
import { NextRequest, NextResponse } from "next/server";
import {
  airtableSGSSTConfig
} from "@/infrastructure/config/airtableSGSST";

export async function GET() {
  try {
    const url = new URL(
      `${airtableSGSSTConfig.baseUrl}/${airtableSGSSTConfig.baseId}/${airtableSGSSTConfig.entregasTableId}`
    );

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        Authorization: `Bearer ${airtableSGSSTConfig.apiToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: "Error al consultar datos" },
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

## Tokens de Firma Remota

Para firmar documentos sin autenticación (empleados reciben link por WhatsApp/email):

```typescript
import { generateSigningToken, verifySigningToken } from "@/lib/signingToken";

// Generar token (en endpoint protegido)
const token = generateSigningToken(
  { registroId, empleadoId, tipo: "asistencia" },
  process.env.JWT_SECRET!,
  24 // horas de validez
);

// Verificar token (en endpoint público)
const payload = verifySigningToken(token, process.env.JWT_SECRET!);
if (!payload) {
  return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 });
}
```

## Generación de PDFs

```typescript
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

const doc = new jsPDF();
autoTable(doc, {
  head: [["Nombre", "Documento", "Firma"]],
  body: asistentes.map(a => [a.nombre, a.documento, a.firmo ? "✓" : "—"]),
});

const buffer = Buffer.from(doc.output("arraybuffer"));
// Upload a S3 o retornar como response
```

## Exportación Excel

```typescript
import ExcelJS from "exceljs";

const workbook = new ExcelJS.Workbook();
const sheet = workbook.addWorksheet("Asistencia");
sheet.addRow(["Nombre", "Documento", "Fecha"]);
// ... agregar filas

const buffer = await workbook.xlsx.writeBuffer();
return new Response(buffer, {
  headers: {
    "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "Content-Disposition": `attachment; filename=asistencia.xlsx`,
  },
});
```
