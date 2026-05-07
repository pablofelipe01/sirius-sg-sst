# 📋 ANÁLISIS DE INFRAESTRUCTURA: INSPECCIONES DE ÁREAS

**Fecha**: 2026-03-20
**Base de datos**: Sirius SG-SST (Airtable)
**Módulo**: Inspecciones de Áreas Físicas

---

## 🔍 RESUMEN EJECUTIVO

**Estado actual**: ❌ **NO OPERATIVO** - Las tablas necesarias NO existen en Airtable.

**Problema crítico**: El código del sistema está configurado para usar 4 tablas de Airtable que **NO HAN SIDO CREADAS** en la base de datos.

---

## 📊 ANÁLISIS DE COMPONENTES

### 1️⃣ FORMULARIO WEB (Frontend)

**Ubicación**: `src/app/dashboard/inspecciones-areas/page.tsx`

**Datos que captura el formulario**:

#### A. Datos Generales de la Inspección
- **Fecha de Inspección** (date)
- **Responsable Inspección** (dropdown - desde Miembros Comités SST)
- **Área Inspeccionada** (select):
  - Laboratorio
  - Pirólisis
  - Bodega
  - Administrativa
  - Guaicaramo
- **Observaciones Generales** (textarea)

#### B. Criterios de Evaluación (Dinámicos por Área)
Cada criterio incluye:
- **Categoría** (string) - Ej: "Condiciones locativas", "Riesgos químicos", etc.
- **Criterio** (string) - Descripción del aspecto a evaluar
- **Condición** (select):
  - Bueno (B)
  - Malo (M)
  - No Aplica (N/A)
- **Observación** (text) - Comentarios específicos del criterio

**Cantidad de criterios por área**:
- Laboratorio: ~27 criterios
- Pirólisis: ~42 criterios
- Bodega: ~19 criterios (comunes + específicos)
- Administrativa: ~15 criterios (comunes + específicos)
- Guaicaramo: ~15 criterios (comunes + específicos)

#### C. Acciones Correctivas/Preventivas
Cada acción incluye:
- **Descripción** (textarea) - Detalle de la acción
- **Tipo** (select):
  - Correctiva
  - Preventiva
  - Mejora
- **Responsable** (text) - Persona encargada
- **Fecha Propuesta de Cierre** (date)

#### D. Firmas de Responsables
El formulario solicita 3 firmas:
1. **Responsable** (Responsable de la inspección)
2. **COPASST** (Miembro del comité)
3. **Responsable Área** (Encargado del área inspeccionada)

Para cada firma se captura:
- **Nombre completo** (text)
- **Cédula** (text)
- **Cargo** (text)
- **Firma digital** (canvas - convertido a base64)

---

### 2️⃣ CONFIGURACIÓN DEL CÓDIGO (Backend)

**Ubicación**: `src/infrastructure/config/airtableSGSST.ts`

**Tablas configuradas en el código**:

#### Tabla 1: "Inspecciones Áreas" (Cabecera)
```typescript
inspeccionesAreasTableId: process.env.AIRTABLE_INSPA_TABLE_ID
```

**Campos requeridos**:
- `ID` - Código de inspección (INSPA-XXX-YYYYMMDD-RRRR)
- `FECHA` - Fecha de la inspección
- `INSPECTOR` - Nombre del responsable de la inspección
- `AREA` - Área inspeccionada
- `ESTADO` - Estado de la inspección (Completado)
- `OBSERVACIONES` - Observaciones generales
- `URL_DOCUMENTO` - URL del documento PDF generado
- `FECHA_EXPORTACION` - Fecha de generación del PDF
- `DETALLE_LINK` - Link a registros de "Detalle Inspección Áreas"
- `RESPONSABLES_LINK` - Link a registros de "Responsables Inspección Áreas"
- `ACCIONES_LINK` - Link a registros de "Acciones Correctivas Áreas"

#### Tabla 2: "Detalle Inspección Áreas"
```typescript
detalleInspeccionAreasTableId: process.env.AIRTABLE_DETINSPA_TABLE_ID
```

**Campos requeridos**:
- `ID` - Identificador único del detalle
- `INSPECCION_LINK` - Link a "Inspecciones Áreas"
- `CATEGORIA` - Categoría del criterio
- `CRITERIO` - Descripción del criterio evaluado
- `CONDICION` - Condición encontrada (Bueno/Malo/NA)
- `OBSERVACION` - Observaciones específicas

**Relación**: Muchos a Uno con "Inspecciones Áreas"

#### Tabla 3: "Responsables Inspección Áreas"
```typescript
respInspeccionAreasTableId: process.env.AIRTABLE_RESPINSPA_TABLE_ID
```

**Campos requeridos**:
- `ID_FIRMA` - Identificador único de la firma
- `INSPECCION_LINK` - Link a "Inspecciones Áreas"
- `TIPO` - Tipo de responsable (Responsable/COPASST/Responsable Área)
- `NOMBRE` - Nombre completo
- `CEDULA` - Número de cédula
- `CARGO` - Cargo del firmante
- `FIRMA` - Firma encriptada (AES-256-CBC)
- `FECHA_FIRMA` - Fecha y hora de la firma

**Relación**: Muchos a Uno con "Inspecciones Áreas"

#### Tabla 4: "Acciones Correctivas Áreas"
```typescript
accionesCorrectivasAreasTableId: process.env.AIRTABLE_ACCINSPA_TABLE_ID
```

**Campos requeridos**:
- `ID` - Identificador único de la acción
- `INSPECCION_LINK` - Link a "Inspecciones Áreas"
- `DESCRIPCION` - Descripción de la acción
- `TIPO` - Tipo de acción (Preventiva/Correctiva/Mejora)
- `RESPONSABLE` - Responsable de ejecutar la acción
- `FECHA_PROPUESTA` - Fecha propuesta de cierre
- `ESTADO` - Estado de la acción (Pendiente por defecto)
- `FECHA_CIERRE` - Fecha real de cierre (opcional)
- `EVIDENCIA_URL` - URL de evidencias (opcional)

**Relación**: Muchos a Uno con "Inspecciones Áreas"

---

### 3️⃣ API ROUTE (Lógica de Negocio)

**Ubicación**: `src/app/api/inspecciones-areas/route.ts`

**Endpoints implementados**:

#### GET `/api/inspecciones-areas?responsables=true`
- Retorna lista de responsables SST para el dropdown
- **Fuente actual**: Tabla "Miembros Comités SST"
- **Filtro actual**: `ESTADO="Activo" AND COMITE="SST"`
- **Problema encontrado**: El filtro busca `COMITE="SST"` pero solo existen "COPASST" y "COCOLAB"

#### GET `/api/inspecciones-areas?copasst=true`
- Retorna lista de miembros del COPASST
- **Fuente**: Tabla "Miembros Comités SST"
- **Filtro**: `ESTADO="Activo" AND COMITE="COPASST"`

#### GET `/api/inspecciones-areas?personal=true`
- Retorna lista de todo el personal activo
- **Fuente**: API `/api/personal`

#### GET `/api/inspecciones-areas` (con filtros)
- Lista inspecciones realizadas
- **Filtros opcionales**: área, estado

#### POST `/api/inspecciones-areas`
Guarda una nueva inspección en 4 pasos:
1. Crea el registro cabecera en "Inspecciones Áreas"
2. Crea los detalles (criterios evaluados) en "Detalle Inspección Áreas" (lotes de 10)
3. Crea las acciones correctivas en "Acciones Correctivas Áreas" (lotes de 10)
4. Crea las firmas (encriptadas) en "Responsables Inspección Áreas"

**Seguridad**:
- Las firmas se encriptan con AES-256-CBC antes de guardar
- Incluye timestamp y metadatos en la firma encriptada

---

## ❌ PROBLEMAS IDENTIFICADOS

### 🚨 CRÍTICO: Tablas No Existen en Airtable

**Estado actual en Airtable**:
- ❌ Tabla "Inspecciones Áreas" → **NO EXISTE**
- ❌ Tabla "Detalle Inspección Áreas" → **NO EXISTE**
- ❌ Tabla "Responsables Inspección Áreas" → **NO EXISTE**
- ❌ Tabla "Acciones Correctivas Áreas" → **NO EXISTE**

**Consecuencia**: El sistema arroja errores al intentar guardar una inspección porque las tablas destino no están creadas.

### 🔴 Variables de Entorno Faltantes

Las siguientes variables NO están definidas en `.env.local`:

```env
# Tabla "Inspecciones Áreas"
AIRTABLE_INSPA_TABLE_ID=
AIRTABLE_INSPA_ID=
AIRTABLE_INSPA_FECHA=
AIRTABLE_INSPA_INSPECTOR=
AIRTABLE_INSPA_AREA=
AIRTABLE_INSPA_ESTADO=
AIRTABLE_INSPA_OBSERVACIONES=
AIRTABLE_INSPA_URL_DOCUMENTO=
AIRTABLE_INSPA_FECHA_EXPORTACION=
AIRTABLE_INSPA_DETALLE_LINK=
AIRTABLE_INSPA_RESPONSABLES_LINK=
AIRTABLE_INSPA_ACCIONES_LINK=

# Tabla "Detalle Inspección Áreas"
AIRTABLE_DETINSPA_TABLE_ID=
AIRTABLE_DETINSPA_ID=
AIRTABLE_DETINSPA_INSPECCION_LINK=
AIRTABLE_DETINSPA_CATEGORIA=
AIRTABLE_DETINSPA_CRITERIO=
AIRTABLE_DETINSPA_CONDICION=
AIRTABLE_DETINSPA_OBSERVACION=

# Tabla "Responsables Inspección Áreas"
AIRTABLE_RESPINSPA_TABLE_ID=
AIRTABLE_RESPINSPA_ID_FIRMA=
AIRTABLE_RESPINSPA_INSPECCION_LINK=
AIRTABLE_RESPINSPA_TIPO=
AIRTABLE_RESPINSPA_NOMBRE=
AIRTABLE_RESPINSPA_CEDULA=
AIRTABLE_RESPINSPA_CARGO=
AIRTABLE_RESPINSPA_FIRMA=
AIRTABLE_RESPINSPA_FECHA_FIRMA=

# Tabla "Acciones Correctivas Áreas"
AIRTABLE_ACCINSPA_TABLE_ID=
AIRTABLE_ACCINSPA_ID=
AIRTABLE_ACCINSPA_INSPECCION_LINK=
AIRTABLE_ACCINSPA_DESCRIPCION=
AIRTABLE_ACCINSPA_TIPO=
AIRTABLE_ACCINSPA_RESPONSABLE=
AIRTABLE_ACCINSPA_FECHA_PROPUESTA=
AIRTABLE_ACCINSPA_ESTADO=
AIRTABLE_ACCINSPA_FECHA_CIERRE=
AIRTABLE_ACCINSPA_EVIDENCIA_URL=
```

### 🟡 Problema de Filtro en Responsables

**Línea 95 del route.ts**:
```javascript
const formula = encodeURIComponent(`AND({${mF.ESTADO}}="Activo", {${mF.COMITE}}="SST")`);
```

**Problema**: Busca `COMITE="SST"` pero en la base de datos solo existen:
- "COPASST" (Comité Paritario de Seguridad y Salud en el Trabajo)
- "COCOLAB" (Comité de Convivencia Laboral)

**Solución aplicada**: Cambiar filtro para incluir COPASST + personas con cargo "Responsable SG-SST"

---

## ✅ SOLUCIÓN PROPUESTA

### FASE 1: Crear Tablas en Airtable

#### 🔹 Tabla 1: "Inspecciones Áreas"

**Estructura**:

| Campo | Tipo | Descripción | Opciones/Formato |
|-------|------|-------------|------------------|
| ID | Formula | Código INSPA-XXX-YYYYMMDD-RRRR | Auto-generado |
| Fecha | Date | Fecha de inspección | - |
| Inspector | Single Line Text | Nombre del inspector | - |
| Área | Single Select | Área inspeccionada | Laboratorio, Pirólisis, Bodega, Administrativa, Guaicaramo |
| Estado | Single Select | Estado de la inspección | Completado, En Revisión, Archivado |
| Observaciones | Long Text | Observaciones generales | - |
| URL Documento | URL | Link al PDF generado | - |
| Fecha Exportación | Date | Fecha de exportación del PDF | - |
| Detalle Inspección | Link to Detalle Inspección Áreas | Criterios evaluados | Multiple records |
| Responsables | Link to Responsables Inspección Áreas | Firmas | Multiple records |
| Acciones Correctivas | Link to Acciones Correctivas Áreas | Acciones derivadas | Multiple records |

#### 🔹 Tabla 2: "Detalle Inspección Áreas"

| Campo | Tipo | Descripción | Opciones/Formato |
|-------|------|-------------|------------------|
| ID | Single Line Text | ID único del detalle | - |
| Inspección | Link to Inspecciones Áreas | Inspección padre | Single record |
| Categoría | Single Line Text | Categoría del criterio | - |
| Criterio | Long Text | Descripción del criterio | - |
| Condición | Single Select | Estado encontrado | Bueno, Malo, NA |
| Observación | Long Text | Observaciones específicas | - |

#### 🔹 Tabla 3: "Responsables Inspección Áreas"

| Campo | Tipo | Descripción | Opciones/Formato |
|-------|------|-------------|------------------|
| ID Firma | Single Line Text | ID único de la firma | - |
| Inspección | Link to Inspecciones Áreas | Inspección padre | Single record |
| Tipo | Single Select | Tipo de responsable | Responsable, COPASST, Responsable Área |
| Nombre | Single Line Text | Nombre completo | - |
| Cédula | Single Line Text | Número de documento | - |
| Cargo | Single Line Text | Cargo del firmante | - |
| Firma | Long Text | Firma encriptada (AES-256) | - |
| Fecha Firma | Date with time | Fecha y hora de firma | - |

#### 🔹 Tabla 4: "Acciones Correctivas Áreas"

| Campo | Tipo | Descripción | Opciones/Formato |
|-------|------|-------------|------------------|
| ID | Single Line Text | ID único de la acción | - |
| Inspección | Link to Inspecciones Áreas | Inspección origen | Single record |
| Descripción | Long Text | Detalle de la acción | - |
| Tipo | Single Select | Tipo de acción | Preventiva, Correctiva, Mejora |
| Responsable | Single Line Text | Encargado de la acción | - |
| Fecha Propuesta | Date | Fecha propuesta de cierre | - |
| Estado | Single Select | Estado actual | Pendiente, En Progreso, Completado, Cancelado |
| Fecha Cierre | Date | Fecha real de cierre | - |
| Evidencia | URL | Link a evidencias | - |

---

### FASE 2: Configurar Variables de Entorno

Una vez creadas las tablas, obtener los Field IDs de Airtable y agregarlos al archivo `.env.local`.

**Proceso**:
1. Abrir cada tabla en Airtable
2. Hacer clic en el nombre de cada campo
3. Copiar el Field ID (formato: `fld...`)
4. Agregar al `.env.local` con el formato correcto

---

### FASE 3: Validar Funcionamiento

**Checklist de pruebas**:

- [ ] **Frontend**: El formulario carga correctamente
- [ ] **Dropdown**: Se cargan los responsables SST (COPASST + RSST)
- [ ] **Áreas**: Se pueden seleccionar las 5 áreas
- [ ] **Criterios**: Se cargan dinámicamente según el área seleccionada
- [ ] **Evaluación**: Se pueden marcar criterios como B/M/NA
- [ ] **Acciones**: Se pueden agregar acciones correctivas
- [ ] **Firmas**: El canvas de firma funciona
- [ ] **Guardar**: La inspección se guarda correctamente en Airtable
  - [ ] Se crea el registro cabecera
  - [ ] Se crean los detalles (criterios)
  - [ ] Se crean las acciones correctivas
  - [ ] Se crean las firmas encriptadas
- [ ] **Listado**: Las inspecciones aparecen en el historial

---

## 📈 FLUJO DE DATOS CORRECTO

```
┌─────────────────────────────────────────────────────────────┐
│                    FORMULARIO WEB                           │
│  (src/app/dashboard/inspecciones-areas/page.tsx)           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ POST /api/inspecciones-areas
                         │ {fechaInspeccion, inspector, area,
                         │  criterios[], accionesCorrectivas[],
                         │  responsables[]}
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                      API ROUTE                              │
│   (src/app/api/inspecciones-areas/route.ts)                │
│                                                             │
│  1. Genera ID: INSPA-LAB-20260320-A1B2                     │
│  2. Valida payload                                          │
│  3. Encripta firmas (AES-256-CBC)                           │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ 4 operaciones en paralelo
                         │
        ┌────────────────┼────────────────┬───────────────┐
        ▼                ▼                ▼               ▼
┌──────────────┐ ┌──────────────┐ ┌─────────────┐ ┌────────────┐
│ Inspecciones │ │   Detalle    │ │  Acciones   │ │Responsables│
│    Áreas     │ │  Inspección  │ │ Correctivas │ │ Inspección │
│  (Cabecera)  │ │    Áreas     │ │   Áreas     │ │   Áreas    │
│              │ │              │ │             │ │  (Firmas)  │
│ • ID         │ │ • Categoría  │ │ • Tipo      │ │ • Nombre   │
│ • Fecha      │ │ • Criterio   │ │ • Descrip.  │ │ • Cédula   │
│ • Inspector  │ │ • Condición  │ │ • Responsab.│ │ • Firma    │
│ • Área       │ │ • Observ.    │ │ • Fecha     │ │  (cifrada) │
└──────────────┘ └──────────────┘ └─────────────┘ └────────────┘
      (1)             (N)              (N)              (3)
```

**Relaciones**:
- 1 Inspección → N Detalles (criterios evaluados)
- 1 Inspección → N Acciones Correctivas
- 1 Inspección → 3 Responsables (firmas)

---

## 🎯 CONCLUSIÓN

**Estado actual**: ❌ El módulo de Inspecciones de Áreas **NO PUEDE FUNCIONAR** porque:

1. ❌ Las 4 tablas necesarias NO existen en Airtable
2. ❌ Las variables de entorno NO están configuradas (43 variables faltantes)
3. 🟡 El filtro de responsables está buscando un comité incorrecto (ya corregido en código)

**Para hacerlo funcionar se requiere**:

1. ✅ **Crear las 4 tablas** en Airtable con la estructura definida arriba
2. ✅ **Obtener los Field IDs** de cada campo
3. ✅ **Configurar las 43 variables de entorno** en `.env.local`
4. ✅ **Reiniciar el servidor** Next.js para aplicar los cambios
5. ✅ **Probar el flujo completo** desde el formulario hasta la base de datos

**Tiempo estimado de implementación**:
- Creación de tablas: 30-45 minutos
- Configuración de variables: 15-20 minutos
- Pruebas: 20-30 minutos
- **Total**: ~1.5 horas

---

**Autor del análisis**: Claude Code
**Última actualización**: 2026-03-20
