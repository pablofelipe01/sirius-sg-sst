# Análisis: Sistema de Asistencia con Firmas para Comités COPASST/COCOLAB

**Fecha:** 2026-04-30  
**Objetivo:** Agregar firma individual por asistente en actas de comités

---

## 1. ESTADO ACTUAL DE LA BASE DE DATOS

### 1.1 Tablas Existentes en Airtable (Base SG-SST)

#### Tabla: `copasst_actas` (tblJpIaDKDurrY3AK)
**Propósito:** Cabecera de actas COPASST

**Campos configurados:**
```env
COPASST_ACTAS_TABLE_ID=tblJpIaDKDurrY3AK
COPASST_ACTAS_ID_FIELD=fld65Bva0vWN4TOqa
COPASST_ACTAS_NUMERO_ACTA_FIELD=fld65Bva0vWN4TOqa
COPASST_ACTAS_MES_EVALUADO_FIELD=
COPASST_ACTAS_FECHA_REUNION_FIELD=
COPASST_ACTAS_HORA_INICIO_FIELD=
COPASST_ACTAS_HORA_CIERRE_FIELD=
COPASST_ACTAS_LUGAR_FIELD=
COPASST_ACTAS_ACCIDENTES_FIELD=
COPASST_ACTAS_ACCIDENTES_DETALLE_FIELD=
COPASST_ACTAS_INCIDENTES_FIELD=
COPASST_ACTAS_INCIDENTES_DETALLE_FIELD=
COPASST_ACTAS_NOVEDADES_FIELD=
COPASST_ACTAS_ESTADO_FIELD=
COPASST_ACTAS_FIRMA_PRESIDENTE_FIELD=
COPASST_ACTAS_FIRMA_SECRETARIO_FIELD=
COPASST_ACTAS_URL_DOCUMENTO_FIELD=
COPASST_ACTAS_FECHA_EXPORT_FIELD=
COPASST_ACTAS_ASISTENTES_LINK_FIELD=      ← ⚠️ Apunta directo a "Miembros Comite SST"
COPASST_ACTAS_CAPACITACIONES_LINK_FIELD=
COPASST_ACTAS_CONDICIONES_LINK_FIELD=
COPASST_ACTAS_COMPROMISOS_LINK_FIELD=
COPASST_ACTAS_CREATED_AT_FIELD=
COPASST_ACTAS_UPDATED_AT_FIELD=
```

#### Tabla: `cocolab_actas` (tblRVTDnlBNYMlq89)
**Propósito:** Cabecera de actas COCOLAB

**Campos clave:**
```env
COCOLAB_ACTAS_TABLE_ID=tblRVTDnlBNYMlq89
COCOLAB_ACTAS_ASISTENTES_LINK_FIELD=      ← ⚠️ Apunta directo a "Miembros Comite SST"
```

#### Tabla: `Miembros Comite SST` (tbl6bA8ZA7WVOckHI)
**Propósito:** Catálogo maestro de integrantes de comités (compartida)

**Campos configurados:**
```env
MIEMBROS_COMITE_TABLE_ID=tbl6bA8ZA7WVOckHI
MIEMBROS_COMITE_ID_FIELD=
MIEMBROS_COMITE_NOMBRE_FIELD=fldZqBOFW4Z5BYrdA
MIEMBROS_COMITE_CEDULA_FIELD=
MIEMBROS_COMITE_CARGO_FIELD=
MIEMBROS_COMITE_COMITE_FIELD=fldEOFTedLwSG4pmW      ← singleSelect: COPASST|COCOLAB
MIEMBROS_COMITE_ROL_FIELD=
MIEMBROS_COMITE_ESTADO_FIELD=
MIEMBROS_COMITE_EMPLEADO_CORE_FIELD=
MIEMBROS_COMITE_REPRESENTACION_FIELD=
MIEMBROS_COMITE_FECHA_INICIO_FIELD=
MIEMBROS_COMITE_FECHA_FIN_FIELD=
```

**⚠️ OBSERVACIÓN:** Esta tabla NO tiene campo de firma porque es un catálogo maestro, no registro de asistencia.

---

## 2. PROBLEMA ACTUAL

### 2.1 Arquitectura Actual
```
copasst_actas
└── ASISTENTES_LINK (multipleRecordLink) → [rec1, rec2, rec3]
                                            ↓
                                    Miembros Comite SST
                                    ├── rec1 (Juan Pérez)
                                    ├── rec2 (Ana García)
                                    └── rec3 (Carlos López)
```

**Limitaciones:**
- ❌ No hay lugar para guardar firma individual por asistente por acta
- ❌ No se puede almacenar metadata de asistencia (fecha/hora firma, confirmación)
- ❌ El flag `asistio` está hardcodeado en el código (línea 430 actasRepository.ts: `asistio: true`)
- ❌ No hay diferencia entre "registrado en el acta" vs "firmó asistencia"

### 2.2 Código Actual (src/lib/comites/actasRepository.ts)

**Líneas 422-440 - Lógica actual de asistentes:**
```typescript
// Resolver asistentes (linked records → Miembros Comite SST)
const asistentesIds = (rec.fields[F.ASISTENTES_LINK] as string[]) || [];
if (asistentesIds.length) {
  try {
    const map = await fetchMiembrosByRecordIds(asistentesIds);
    acta.asistentes = asistentesIds.map((rid): AsistenteActa => {
      const m = map.get(rid);
      return {
        recordId: rid,
        asistio: true,  // ← ⚠️ HARDCODEADO: todos marcan asistencia
        nombre: m?.nombre,
        cedula: m?.cedula,
        cargo: m?.cargo,
        rol: m?.rol,
      };
    });
  } catch (e) {
    console.error("[comites] error resolviendo asistentes:", e);
  }
}
```

**Líneas 636-655 - Creación de acta:**
```typescript
const cabeceraFields: Record<string, unknown> = {
  [F.ID]: idActa,
  ...cabeceraFieldsFromDomain(comite, {...}),
  [F.ASISTENTES_LINK]: payload.asistentesRecordIds,  // ← Array de IDs directo
  [F.COMPROMISOS_LINK]: compromisosRecIds,
  // ...
};
```

**Tipos actuales (src/lib/comites/types.ts):**
```typescript
export interface AsistenteActa {
  recordId: string;             // FK a Miembros Comite SST
  asistio: boolean;
  // Datos derivados (snapshot, llenados al leer)
  nombre?: string;
  cedula?: string;
  cargo?: string;
  rol?: string;
  // ❌ NO HAY CAMPO: firma?: string;
  // ❌ NO HAY CAMPO: fechaFirma?: string;
}
```

---

## 3. PATRONES EXISTENTES EN EL SISTEMA

### 3.1 Patrón "Asistencia Capacitaciones"

**Tabla:** `Asistencia Capacitaciones` (AIRTABLE_ASIS_TABLE_ID)

**Estructura:**
```typescript
asistenciaCapacitacionesFields: {
  ID_ASISTENCIA:    process.env.AIRTABLE_ASIS_ID_ASISTENCIA!,
  NOMBRES:          process.env.AIRTABLE_ASIS_NOMBRES!,
  CEDULA:           process.env.AIRTABLE_ASIS_CEDULA!,
  LABOR:            process.env.AIRTABLE_ASIS_LABOR!,
  FIRMA_CONFIRMADA: process.env.AIRTABLE_ASIS_FIRMA_CONFIRMADA!,  // checkbox
  FECHA_REGISTRO:   process.env.AIRTABLE_ASIS_FECHA_REGISTRO!,
  EVENTO_LINK:      process.env.AIRTABLE_ASIS_EVENTO_LINK!,       // FK al evento
  ID_EMPLEADO_CORE: process.env.AIRTABLE_ASIS_ID_EMPLEADO_CORE!,
  PROGRAMACION_LINK: process.env.AIRTABLE_ASIS_PROGRAMACION_LINK!,
  FIRMA:            process.env.AIRTABLE_ASIS_FIRMA!,             // longText: data URL
}
```

**Arquitectura:**
```
Eventos Capacitación (cabecera)
    ↓
Asistencia Capacitaciones (detalle con firma)
├── rec1: Juan Pérez → FIRMA: "data:image/png;base64,..."
├── rec2: Ana García → FIRMA: "data:image/png;base64,..."
└── rec3: Carlos López → FIRMA: "data:image/png;base64,..."
```

### 3.2 Patrón "Responsables Inspección Áreas"

**Tabla:** `Responsables Inspección Áreas` (AIRTABLE_RESPINSPA_TABLE_ID)

**Estructura:**
```typescript
respInspeccionAreasFields: {
  ID_FIRMA:         process.env.AIRTABLE_RESPINSPA_ID_FIRMA!,
  INSPECCION_LINK:  process.env.AIRTABLE_RESPINSPA_INSPECCION_LINK!,
  TIPO:             process.env.AIRTABLE_RESPINSPA_TIPO!,      // "responsable"|"copasst"
  NOMBRE:           process.env.AIRTABLE_RESPINSPA_NOMBRE!,
  CEDULA:           process.env.AIRTABLE_RESPINSPA_CEDULA!,
  CARGO:            process.env.AIRTABLE_RESPINSPA_CARGO!,
  FIRMA:            process.env.AIRTABLE_RESPINSPA_FIRMA!,     // longText: data URL
  FECHA_FIRMA:      process.env.AIRTABLE_RESPINSPA_FECHA_FIRMA!, // dateTime
}
```

**✅ CONCLUSIÓN:** El sistema usa tablas intermedias con firma individual, no campos en catálogos maestros.

---

## 4. SOLUCIÓN PROPUESTA

### 4.1 Nueva Tabla: `asistencia_comites`

**Propósito:** Tabla intermedia para registrar asistencia + firma por acta

**Esquema propuesto:**

| Campo | Tipo | Descripción | Ejemplo |
|---|---|---|---|
| `ID_ASISTENCIA` | singleLineText (PK) | ID único | `AST-COPASST-abc123` |
| `ACTA_COPASST_LINK` | multipleRecordLink | FK a copasst_actas | `[rec...]` |
| `ACTA_COCOLAB_LINK` | multipleRecordLink | FK a cocolab_actas | `[rec...]` |
| `MIEMBRO_LINK` | multipleRecordLink | FK a Miembros Comite SST | `[rec...]` |
| `COMITE` | singleSelect | Discriminador | `COPASST` \| `COCOLAB` |
| `ASISTIO` | checkbox | Confirmó asistencia | `true` / `false` |
| `FIRMA` | longText | Data URL canvas | `data:image/png;base64,...` |
| `FECHA_FIRMA` | dateTime | Timestamp firma | `2026-04-30T14:30:00Z` |
| `OBSERVACIONES` | longText | Notas (opcional) | `Firmó tarde` |

**Variables de entorno necesarias (.env):**
```env
# ── Asistencia Comités (tabla intermedia) ──
ASISTENCIA_COMITES_TABLE_ID=tblXXXXXXXXXXXXXXX
ASISTENCIA_COMITES_ID_FIELD=
ASISTENCIA_COMITES_ACTA_COPASST_LINK_FIELD=
ASISTENCIA_COMITES_ACTA_COCOLAB_LINK_FIELD=
ASISTENCIA_COMITES_MIEMBRO_LINK_FIELD=
ASISTENCIA_COMITES_COMITE_FIELD=
ASISTENCIA_COMITES_ASISTIO_FIELD=
ASISTENCIA_COMITES_FIRMA_FIELD=
ASISTENCIA_COMITES_FECHA_FIRMA_FIELD=
ASISTENCIA_COMITES_OBSERVACIONES_FIELD=
```

### 4.2 Cambios en Código TypeScript

**Actualizar tipos (src/lib/comites/types.ts):**
```typescript
export interface AsistenteActa {
  id?: string;                  // ← NUEVO: record ID de asistencia_comites
  recordId: string;             // FK a Miembros Comite SST (para lookup)
  asistio: boolean;
  firma?: string | null;        // ← NUEVO: Data URL
  fechaFirma?: string | null;   // ← NUEVO: ISO timestamp
  observaciones?: string | null; // ← NUEVO
  // Datos derivados (snapshot de miembro)
  nombre?: string;
  cedula?: string;
  cargo?: string;
  rol?: string;
}
```

**Actualizar actasRepository.ts:**

1. **Línea 181-195** — Mapper: Leer asistencia desde tabla intermedia
2. **Línea 422-440** — `obtenerActaPorId`: Fetch de `asistencia_comites` en vez de `Miembros Comite SST`
3. **Línea 563-687** — `crearActa`: Insertar registros en `asistencia_comites`
4. **Línea 689-806** — `actualizarActa`: Reemplazar registros de asistencia

**Nueva función:**
```typescript
export async function firmarAsistencia(
  comite: ComiteTipo,
  idActa: string,
  miembroRecordId: string,
  firmaDataUrl: string
): Promise<void> {
  // 1. Buscar registro de asistencia
  // 2. Actualizar campos FIRMA + FECHA_FIRMA + ASISTIO=true
}
```

### 4.3 Cambios en UI

**Archivo:** `src/app/dashboard/comites/[comite]/nueva/page.tsx`

**Línea 123-125 — Estado:**
```typescript
const [firmasMap, setFirmasMap] = useState<Record<string, string>>({});
```

**Componente nuevo:**
```tsx
<div className="flex items-center gap-2">
  <input
    type="checkbox"
    checked={asistenciaMap[m.recordId]}
    onChange={(e) => setAsistenciaMap({ ...asistenciaMap, [m.recordId]: e.target.checked })}
  />
  {asistenciaMap[m.recordId] && (
    <button
      onClick={() => abrirModalFirma(m)}
      className="btn-firma"
    >
      {firmasMap[m.recordId] ? "✓ Firmado" : "Firmar"}
    </button>
  )}
</div>
```

---

## 5. MIGRACIÓN DE DATOS EXISTENTES

⚠️ **IMPORTANTE:** Si ya existen actas con asistentes en el campo `ASISTENTES_LINK`:

**Script de migración:**
```sql
-- Pseudo-código
FOR cada acta IN copasst_actas:
  FOR cada miembro_id IN acta.ASISTENTES_LINK:
    INSERT INTO asistencia_comites:
      ID_ASISTENCIA: generar("AST-COPASST-xxx")
      ACTA_COPASST_LINK: [acta.id]
      MIEMBRO_LINK: [miembro_id]
      COMITE: "COPASST"
      ASISTIO: true
      FIRMA: null  # Sin firma histórica
      FECHA_FIRMA: null
```

**Después de migración:**
- ✅ `ASISTENTES_LINK` en cabecera queda obsoleto (no eliminar campo, dejar vacío)
- ✅ Nueva relación: `acta → ASISTENCIA_LINK → asistencia_comites`

---

## 6. CAMPOS A AGREGAR EN TABLA CABECERA

**En:** `copasst_actas` / `cocolab_actas`

**Nuevo campo (opcional):**
```
ASISTENCIA_LINK (multipleRecordLink → asistencia_comites)
```

**Variables .env:**
```env
COPASST_ACTAS_ASISTENCIA_LINK_FIELD=
COCOLAB_ACTAS_ASISTENCIA_LINK_FIELD=
```

**Actualizar airtableSGSST.ts:**
```typescript
copasstActasFields: {
  // ... campos existentes
  ASISTENCIA_LINK: process.env.COPASST_ACTAS_ASISTENCIA_LINK_FIELD || "",
}
```

---

## 7. RESUMEN DE CAMBIOS REQUERIDOS

### 7.1 En Airtable
- [ ] Crear tabla `asistencia_comites` con 9 campos
- [ ] Agregar campo `ASISTENCIA_LINK` en `copasst_actas` (opcional, para back-reference)
- [ ] Agregar campo `ASISTENCIA_LINK` en `cocolab_actas` (opcional)
- [ ] Obtener Field IDs de todos los campos nuevos

### 7.2 En Código
- [ ] Actualizar `.env` con 10+ nuevas variables
- [ ] Actualizar `airtableSGSST.ts` con config de tabla intermedia
- [ ] Modificar `types.ts` para agregar campos firma/fechaFirma en `AsistenteActa`
- [ ] Refactorizar `actasRepository.ts` (4 funciones afectadas)
- [ ] Crear endpoint API `/api/[comite]/actas/[id]/firmar-asistente`
- [ ] Actualizar UI `nueva/page.tsx` con botones de firma
- [ ] Crear componente modal de firma (canvas)

### 7.3 Migración (si hay datos existentes)
- [ ] Script para migrar `ASISTENTES_LINK` → `asistencia_comites`
- [ ] Validar integridad post-migración

---

## 8. VALIDACIONES PROPUESTAS

### 8.1 Reglas de Negocio
- ✅ Un miembro solo puede aparecer una vez por acta
- ✅ Solo se puede firmar si `ASISTIO = true`
- ✅ No se puede borrar firma una vez guardada (auditoría)
- ✅ Quórum: requiere al menos presidente + secretario firmados

### 8.2 Validaciones Técnicas
```typescript
// Antes de crear acta
if (asistentesRecordIds.length < 2) {
  throw new Error("Quórum insuficiente: mínimo 2 asistentes");
}

// Antes de firmar asistencia
if (!asistenciaRecord.fields.ASISTIO) {
  throw new Error("No puede firmar sin marcar asistencia");
}

// Validar firma no duplicada
if (asistenciaRecord.fields.FIRMA) {
  throw new Error("Este asistente ya firmó");
}
```

---

## 9. PRÓXIMOS PASOS

1. **Validación del usuario** sobre la propuesta ✅ (este documento)
2. **Crear tabla en Airtable** con los 9 campos especificados
3. **Obtener Field IDs** desde Airtable API o interfaz
4. **Actualizar .env.example** con las nuevas variables
5. **Implementar cambios en código** siguiendo el orden:
   - Config → Types → Repository → API → UI
6. **Testing** con acta de prueba
7. **Migración** de datos existentes (si aplica)
8. **Documentación** de uso para usuarios finales

---

## 10. RIESGOS Y CONSIDERACIONES

### Riesgos Identificados
- 🟡 **Migración de datos**: Si hay actas firmadas en producción, migración debe preservar estado
- 🟡 **Performance**: Query adicional por acta (JOIN virtual vía API)
- 🟢 **Compatibilidad**: COCOLAB comparte la misma tabla (discriminador: campo COMITE)

### Mitigaciones
- ✅ Mantener `ASISTENTES_LINK` como fallback temporal durante transición
- ✅ Indexar campo `COMITE` en Airtable para queries rápidas
- ✅ Cachear datos de miembros para evitar lookups repetidos

---

**Fin del análisis**
