# Skill: Patrones Airtable — SG-SST

Conocimiento de dominio sobre la integración con Airtable en Sirius SG-SST.

## Bases de Datos

| Base | Config File | Tablas principales |
|---|---|---|
| **Personal** | `airtable.ts` | Personal, Sistemas, Roles |
| **Insumos SST** | `airtableInsumos.ts` | Insumo, Categoría Insumo, Movimientos Insumos, Stock |
| **SG-SST** | `airtableSGSST.ts` | Entregas EPP, Detalle Entrega, Tokens Entrega, Historial EPP, Inspecciones EPP, Detalle Inspección, Equipos Emergencia, Inspecciones Equipos, Detalle Equipos |

## Patrón de Configuración con Field IDs

A diferencia de muchos proyectos que usan nombres de campo, SG-SST usa **field IDs** desde variables de entorno. Esto hace los queries inmunes a renombramientos en Airtable:

```typescript
// src/infrastructure/config/airtable.ts
export const airtableConfig = {
  apiToken: process.env.AIRTABLE_API_TOKEN!,
  baseId: process.env.AIRTABLE_BASE_ID!,
  personalTableId: process.env.AIRTABLE_PERSONAL_TABLE_ID!,

  personalFields: {
    ID_EMPLEADO: process.env.AIRTABLE_PF_ID_EMPLEADO!,
    NOMBRE_COMPLETO: process.env.AIRTABLE_PF_NOMBRE_COMPLETO!,
    NUMERO_DOCUMENTO: process.env.AIRTABLE_PF_NUMERO_DOCUMENTO!,
    PASSWORD: process.env.AIRTABLE_PF_PASSWORD!,
    // ...más fields
  },
};

// Uso en queries con returnFieldsByFieldId=true
url.searchParams.set("returnFieldsByFieldId", "true");
const filterFormula = `{${PF.NUMERO_DOCUMENTO}} = '${numeroDocumento}'`;
```

**Puntos clave**:
- `returnFieldsByFieldId: true` — respuestas usan field IDs como keys
- Fields se referencian como `airtableConfig.personalFields.NOMBRE_COMPLETO`
- Cada base tiene su propio token API y base ID

## Helpers por Base

### Base Personal
```typescript
import { getAirtableUrl, getAirtableHeaders, airtableConfig } from "@/infrastructure/config/airtable";

const url = new URL(getAirtableUrl(airtableConfig.personalTableId));
const res = await fetch(url.toString(), {
  headers: getAirtableHeaders(),
  cache: "no-store",
});
```

### Base Insumos
```typescript
import { getInsumosUrl, getInsumosHeaders, airtableInsumosConfig } from "@/infrastructure/config/airtableInsumos";

const url = new URL(getInsumosUrl(airtableInsumosConfig.insumoTableId));
const res = await fetch(url.toString(), {
  headers: getInsumosHeaders(),
});
```

### Base SG-SST
```typescript
import { airtableSGSSTConfig } from "@/infrastructure/config/airtableSGSST";

const url = `${airtableSGSSTConfig.baseUrl}/${airtableSGSSTConfig.baseId}/${airtableSGSSTConfig.entregasTableId}`;
const res = await fetch(url, {
  headers: {
    Authorization: `Bearer ${airtableSGSSTConfig.apiToken}`,
    "Content-Type": "application/json",
  },
});
```

## Paginación Airtable

Airtable retorna máximo 100 registros por request. Patrón de paginación completa:

```typescript
interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

const allRecords: AirtableRecord[] = [];
let offset: string | undefined;

do {
  const url = new URL(getAirtableUrl(tableId));
  if (offset) url.searchParams.set("offset", offset);

  const res = await fetch(url.toString(), {
    headers: getAirtableHeaders(),
    cache: "no-store",
  });

  const data: AirtableListResponse = await res.json();
  allRecords.push(...data.records);
  offset = data.offset;
} while (offset);
```

## CRUD con Airtable

### Crear registros (POST)
```typescript
const res = await fetch(url, {
  method: "POST",
  headers: getAirtableHeaders(),
  body: JSON.stringify({
    records: [{ fields: { [FIELD_ID]: value } }],
  }),
});
```

### Actualizar registros (PATCH)
```typescript
const res = await fetch(url, {
  method: "PATCH",
  headers: getAirtableHeaders(),
  body: JSON.stringify({
    records: [{ id: recordId, fields: { [FIELD_ID]: newValue } }],
  }),
});
```

### Batch operations
Airtable permite máximo **10 registros por request** en POST/PATCH. Para más:
```typescript
const chunks = [];
for (let i = 0; i < records.length; i += 10) {
  chunks.push(records.slice(i, i + 10));
}
for (const chunk of chunks) {
  await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ records: chunk }),
  });
}
```

## Soft-Delete Pattern

Registros no se eliminan. Se marcan con campo de estado:
```typescript
// PATCH para "eliminar"
body: JSON.stringify({
  records: [{ id: recordId, fields: { [STATUS_FIELD]: "Inactivo" } }],
});

// Al consultar, filtrar activos
url.searchParams.set("filterByFormula", `{${STATUS_FIELD}}!='Inactivo'`);
```

## Prevención de Inyección en Fórmulas

**OBLIGATORIO** sanitizar valores antes de interpolar en `filterByFormula`:

```typescript
// ✅ CORRECTO — sanitizar entrada
const safe = value.replace(/[\x00-\x1f]/g, "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
const formula = `{${FIELD_ID}}='${safe}'`;

// ❌ INCORRECTO — inyección posible
const formula = `{${FIELD_ID}}='${userInput}'`;
```

## Tablas por Módulo

### Entregas EPP (Base SG-SST)
- `Entregas EPP` — cabecera de entrega
- `Detalle Entrega EPP` — items entregados (linked)
- `Tokens Entrega` — tokens de firma remota
- `Historial EPP Empleado` — registro histórico por persona

### Inspecciones EPP (Base SG-SST)
- `Inspecciones EPP` — cabecera de inspección
- `Detalle Inspección EPP` — items inspeccionados

### Equipos Emergencia (Base SG-SST)
- `Equipos Emergencia` — catálogo maestro
- `Inspecciones Equipos Emergencia` — inspecciones realizadas
- `Detalle Inspección Equipos` — items de cada inspección

### Inventario (Base Insumos)
- `Insumo` — catálogo de insumos/EPP
- `Categoría Insumo` — categorías
- `Movimientos Insumos` — entradas/salidas
- `Stock` — stock actual por insumo
