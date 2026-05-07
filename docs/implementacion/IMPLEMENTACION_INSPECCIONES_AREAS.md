# 📋 GUÍA DE IMPLEMENTACIÓN — Inspecciones de Áreas Físicas

## ✅ ESTADO DE IMPLEMENTACIÓN

**Fecha:** 2026-03-19
**Módulo:** Inspecciones de Áreas Físicas
**Base de Datos:** Airtable (Base "Sirius SG-SST")
**Estado del Código:** ✅ COMPLETADO

---

## 📦 ARCHIVOS CREADOS

### Backend (API Routes)
```
src/app/api/inspecciones-areas/
├── route.ts                         ✅ GET/POST
├── [id]/route.ts                    ✅ GET detalle
└── exportar/route.ts                ⚠️  Placeholder (pendiente lógica Excel/PDF)
```

### Frontend (Dashboard)
```
src/app/dashboard/inspecciones-areas/
├── page.tsx                         ✅ Formulario de inspección
└── historial/page.tsx               ✅ Historial de inspecciones
```

### Configuración
```
src/infrastructure/config/
└── airtableSGSST.ts                 ✅ Configuración extendida

.env.example                         ✅ Variables agregadas
```

### Actualizado
```
src/app/dashboard/inspecciones/
└── page.tsx                         ✅ Hub activado (botón Áreas)
```

---

## 🔧 PASO 1 — CREAR TABLAS EN AIRTABLE

### ⚠️ IMPORTANTE: Base "Sirius SG-SST"

Abrir la base **"Sirius SG-SST"** en Airtable y crear las siguientes 4 tablas:

---

### 📋 TABLA 1: "Inspecciones Áreas"

**Campos:**

| Nombre del Campo | Tipo | Configuración |
|---|---|---|
| `ID` | Single line text | Campo principal |
| `Fecha` | Date | Formato: DD/MM/YYYY |
| `Inspector` | Single line text | — |
| `Área` | Single select | Opciones: Laboratorio, Pirólisis, Bodega, Administrativa, Guaicaramo |
| `Estado` | Single select | Opciones: Borrador, Completado |
| `Observaciones Generales` | Long text | — |
| `URL Documento` | URL | — |
| `Fecha Exportación` | Date | — |
| `Detalle Inspección` | Link to another record | → Tabla "Detalle Inspección Áreas" |
| `Responsables` | Link to another record | → Tabla "Responsables Inspección Áreas" |
| `Acciones Correctivas` | Link to another record | → Tabla "Acciones Correctivas Áreas" |

---

### 📋 TABLA 2: "Detalle Inspección Áreas"

**Campos:**

| Nombre del Campo | Tipo | Configuración |
|---|---|---|
| `ID` | Single line text | Campo principal |
| `Inspección` | Link to another record | → Tabla "Inspecciones Áreas" |
| `Categoría` | Single select | Ver lista abajo* |
| `Criterio` | Single line text | — |
| `Condición` | Single select | Opciones: Bueno, Malo, NA |
| `Observación` | Long text | — |

**\*Categorías:**
- Condiciones locativas
- Almacenamiento de materiales
- Seguridad y emergencias
- Riesgos mecánicos y físicos
- Riesgos químicos
- Riesgo ambiental
- Bioseguridad
- Equipos de laboratorio
- Equipos de proceso
- Almacenamiento temporal
- Uso de herramientas menores
- Ergonomía

---

### 📋 TABLA 3: "Responsables Inspección Áreas"

**Campos:**

| Nombre del Campo | Tipo | Configuración |
|---|---|---|
| `ID Firma` | Single line text | Campo principal |
| `Inspección` | Link to another record | → Tabla "Inspecciones Áreas" |
| `Tipo` | Single select | Opciones: Responsable, COPASST, Responsable Área |
| `Nombre` | Single line text | — |
| `Cédula` | Single line text | — |
| `Cargo` | Single line text | — |
| `Firma` | Long text | (firma encriptada AES-256-CBC) |
| `Fecha Firma` | Date | — |

---

### 📋 TABLA 4: "Acciones Correctivas Áreas"

**Campos:**

| Nombre del Campo | Tipo | Configuración |
|---|---|---|
| `ID` | Single line text | Campo principal |
| `Inspección` | Link to another record | → Tabla "Inspecciones Áreas" |
| `Descripción` | Long text | — |
| `Tipo` | Single select | Opciones: Preventiva, Correctiva, Mejora |
| `Responsable` | Single line text | (ID_EMPLEADO_CORE) |
| `Fecha Propuesta Cierre` | Date | — |
| `Estado` | Single select | Opciones: Pendiente, En proceso, Cerrada |
| `Fecha Cierre Real` | Date | — |
| `Evidencia URL` | URL | — |

---

## 🔑 PASO 2 — CONFIGURAR VARIABLES DE ENTORNO

### Obtener Field IDs desde Airtable

1. Abrir cada tabla en Airtable
2. Hacer clic en cualquier campo → "Customize field type"
3. En la URL, copiar el `fldXXXXXXXXXX` (Field ID)
4. Repetir para cada campo

### Actualizar `.env` (o `.env.local`)

Copiar las variables desde `.env.example` y reemplazar los valores `tbl_xxx` y `fld_xxx` con los IDs reales:

```env
# ══════════════════════════════════════════════════════════
# Airtable - Base "Sirius SG-SST" - Inspecciones de Áreas
# ══════════════════════════════════════════════════════════

# Tabla "Inspecciones Áreas" (cabecera)
AIRTABLE_INSPA_TABLE_ID=tbl_tu_id_real_aqui
AIRTABLE_INSPA_ID=fld_tu_id_real_aqui
AIRTABLE_INSPA_FECHA=fld_tu_id_real_aqui
AIRTABLE_INSPA_INSPECTOR=fld_tu_id_real_aqui
AIRTABLE_INSPA_AREA=fld_tu_id_real_aqui
AIRTABLE_INSPA_ESTADO=fld_tu_id_real_aqui
AIRTABLE_INSPA_OBSERVACIONES=fld_tu_id_real_aqui
AIRTABLE_INSPA_URL_DOCUMENTO=fld_tu_id_real_aqui
AIRTABLE_INSPA_FECHA_EXPORTACION=fld_tu_id_real_aqui
AIRTABLE_INSPA_DETALLE_LINK=fld_tu_id_real_aqui
AIRTABLE_INSPA_RESPONSABLES_LINK=fld_tu_id_real_aqui
AIRTABLE_INSPA_ACCIONES_LINK=fld_tu_id_real_aqui

# Tabla "Detalle Inspección Áreas" (criterios evaluados)
AIRTABLE_DETINSPA_TABLE_ID=tbl_tu_id_real_aqui
AIRTABLE_DETINSPA_ID=fld_tu_id_real_aqui
AIRTABLE_DETINSPA_INSPECCION_LINK=fld_tu_id_real_aqui
AIRTABLE_DETINSPA_CATEGORIA=fld_tu_id_real_aqui
AIRTABLE_DETINSPA_CRITERIO=fld_tu_id_real_aqui
AIRTABLE_DETINSPA_CONDICION=fld_tu_id_real_aqui
AIRTABLE_DETINSPA_OBSERVACION=fld_tu_id_real_aqui

# Tabla "Responsables Inspección Áreas" (firmas)
AIRTABLE_RESPINSPA_TABLE_ID=tbl_tu_id_real_aqui
AIRTABLE_RESPINSPA_ID_FIRMA=fld_tu_id_real_aqui
AIRTABLE_RESPINSPA_INSPECCION_LINK=fld_tu_id_real_aqui
AIRTABLE_RESPINSPA_TIPO=fld_tu_id_real_aqui
AIRTABLE_RESPINSPA_NOMBRE=fld_tu_id_real_aqui
AIRTABLE_RESPINSPA_CEDULA=fld_tu_id_real_aqui
AIRTABLE_RESPINSPA_CARGO=fld_tu_id_real_aqui
AIRTABLE_RESPINSPA_FIRMA=fld_tu_id_real_aqui
AIRTABLE_RESPINSPA_FECHA_FIRMA=fld_tu_id_real_aqui

# Tabla "Acciones Correctivas Áreas"
AIRTABLE_ACCINSPA_TABLE_ID=tbl_tu_id_real_aqui
AIRTABLE_ACCINSPA_ID=fld_tu_id_real_aqui
AIRTABLE_ACCINSPA_INSPECCION_LINK=fld_tu_id_real_aqui
AIRTABLE_ACCINSPA_DESCRIPCION=fld_tu_id_real_aqui
AIRTABLE_ACCINSPA_TIPO=fld_tu_id_real_aqui
AIRTABLE_ACCINSPA_RESPONSABLE=fld_tu_id_real_aqui
AIRTABLE_ACCINSPA_FECHA_PROPUESTA=fld_tu_id_real_aqui
AIRTABLE_ACCINSPA_ESTADO=fld_tu_id_real_aqui
AIRTABLE_ACCINSPA_FECHA_CIERRE=fld_tu_id_real_aqui
AIRTABLE_ACCINSPA_EVIDENCIA_URL=fld_tu_id_real_aqui

# Encriptación AES para firmas (compartido con otros módulos)
AES_SIGNATURE_SECRET=tu_secreto_aes_256_aqui
```

**⚠️ Importante:** Si ya tienes `AES_SIGNATURE_SECRET` configurada (del módulo de equipos), reutiliza la misma clave.

---

## 🚀 PASO 3 — VERIFICAR Y PROBAR

### 1. Reiniciar servidor de desarrollo

```bash
npm run dev
```

### 2. Verificar que no hay errores de TypeScript

```bash
npx tsc --noEmit
```

### 3. Probar flujo completo

1. Ir a: `http://localhost:3000/dashboard/inspecciones`
2. Clic en "Inspecciones de Áreas" (ya debe estar activo, sin "Próximamente")
3. Seleccionar un área (ej: Laboratorio)
4. Evaluar criterios (Bueno/Malo/NA)
5. Agregar acciones correctivas (opcional)
6. Firmar con 1-3 responsables
7. Guardar
8. Verificar que se creó el registro en Airtable

### 4. Verificar historial

1. Clic en "Historial" en la página de inspecciones de áreas
2. Verificar que aparece la inspección guardada
3. Clic en una inspección para ver el detalle

---

## 📊 CRITERIOS IMPLEMENTADOS POR ÁREA

### COMUNES (todas las áreas)
- Condiciones locativas (5 criterios)
- Seguridad y emergencias (4 criterios)
- Riesgos químicos (5 criterios)
- Riesgo ambiental (2 criterios)

### BODEGA
- Almacenamiento de materiales (5 criterios)
- Riesgos mecánicos y físicos (4 criterios)
- Riesgo ambiental adicional (1 criterio)

### LABORATORIO
- Bioseguridad (5 criterios)
- Equipos de laboratorio (3 criterios)
- Seguridad adicional (2 criterios)
- Riesgo ambiental adicional (2 criterios)

### PIRÓLISIS
- Equipos de proceso (7 criterios)
- Almacenamiento temporal (2 criterios)
- Uso de herramientas menores (4 criterios)
- Riesgo ambiental adicional (3 criterios)

### ADMINISTRATIVA / GUAICARAMO
- Ergonomía (3 criterios)
- Condiciones adicionales (4 criterios)

---

## 🔒 SEGURIDAD

- ✅ Firmas encriptadas con AES-256-CBC (igual que módulo de equipos)
- ✅ Validación de campos obligatorios
- ✅ No se exponen firmas descifradas en GET
- ✅ Field IDs en variables de entorno (no hardcodeados)

---

## ⚠️ PENDIENTE DE IMPLEMENTACIÓN (OPCIONAL)

1. **Exportación completa a PDF/Excel** (`/api/inspecciones-areas/exportar`)
   - Placeholder creado
   - Seguir patrón de `/api/inspecciones-equipos/exportar`
   - Usar ExcelJS y jsPDF

2. **Página de detalle individual** (`/dashboard/inspecciones-areas/[id]`)
   - Endpoint GET ya existe
   - Crear componente de visualización

3. **Descifrado de firmas** (si se requiere visualizar)
   - Endpoint `/api/inspecciones-areas/descifrar`
   - Seguir patrón de `/api/inspecciones-equipos/descifrar`

---

## 🐛 TROUBLESHOOTING

### Error: "Cannot find module airtableSGSST"
**Solución:** Reiniciar servidor (`npm run dev`)

### Error: "Field ID not found"
**Solución:** Verificar que las variables de entorno tienen los Field IDs correctos de Airtable

### No se guardan las firmas
**Solución:** Verificar que `AES_SIGNATURE_SECRET` está configurado en `.env`

### Error 500 al guardar
**Solución:**
1. Revisar console.log del servidor
2. Verificar que los nombres de campos en Airtable coinciden exactamente
3. Verificar que los valores de Single Select están bien escritos

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Tablas creadas en Airtable (4 tablas)
- [ ] Field IDs copiados y configurados en `.env`
- [ ] Servidor reiniciado
- [ ] No hay errores de TypeScript
- [ ] Botón "Inspecciones de Áreas" activo en hub
- [ ] Formulario carga correctamente
- [ ] Se puede seleccionar área y ver criterios
- [ ] Se pueden firmar responsables
- [ ] Se puede guardar inspección
- [ ] Registros aparecen en Airtable
- [ ] Historial funciona
- [ ] Filtros funcionan

---

## 📚 REFERENCIAS

- **Formatos físicos oficiales:**
  - FT-SST-058 (Bodega)
  - FT-SST-059 (Laboratorio)
  - FT-SST-060 (Pirólisis)
  - FT-SST-061 (Administrativa)

- **Módulos relacionados:**
  - Inspecciones EPP: `/app/api/inspecciones-epp`
  - Inspecciones Equipos: `/app/api/inspecciones-equipos`

- **Patrón de encriptación AES:**
  - Ver: `/app/api/inspecciones-equipos/route.ts` líneas 12-26

---

**🎉 Módulo listo para usar una vez configuradas las variables de entorno.**
