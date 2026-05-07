# 📋 GUÍA: Crear Tabla `asistencia_comites` en Airtable

**Base:** Sirius SG-SST  
**Fecha:** 2026-04-30  
**Duración estimada:** 10 minutos

---

## PASO 1: Crear la Tabla

1. Abre Airtable → Base **"Sirius SG-SST"**
2. Click en **"+"** (agregar tabla)
3. Nombre de la tabla: **`asistencia_comites`**
4. Click **"Create table"**

---

## PASO 2: Configurar Campos

Elimina los campos por defecto y crea estos **9 campos** en este orden:

### Campo 1: ID_ASISTENCIA (Primary Field)
- **Nombre:** `ID_ASISTENCIA`
- **Tipo:** Single line text
- **Configuración:**
  - Hacer clic en el campo "Name" por defecto
  - Cambiar tipo a "Single line text"
  - Renombrar a "ID_ASISTENCIA"
- **Ejemplo de valor:** `AST-COPASST-abc123`

---

### Campo 2: ACTA_COPASST_LINK
- **Nombre:** `ACTA_COPASST_LINK`
- **Tipo:** Link to another record
- **Configuración:**
  - Click en "+" → "Link to another record"
  - Buscar y seleccionar tabla: **`copasst_actas`**
  - **NO** permitir linking a múltiples records (dejar en "Allow linking to multiple records" desmarcado)
  - Nombre del campo en copasst_actas: `asistencia_link` (automático)
- **Propósito:** FK a la acta de COPASST

---

### Campo 3: ACTA_COCOLAB_LINK
- **Nombre:** `ACTA_COCOLAB_LINK`
- **Tipo:** Link to another record
- **Configuración:**
  - Click en "+" → "Link to another record"
  - Buscar y seleccionar tabla: **`cocolab_actas`**
  - **NO** permitir linking a múltiples records
  - Nombre del campo en cocolab_actas: `asistencia_link` (automático)
- **Propósito:** FK a la acta de COCOLAB

---

### Campo 4: MIEMBRO_LINK
- **Nombre:** `MIEMBRO_LINK`
- **Tipo:** Link to another record
- **Configuración:**
  - Click en "+" → "Link to another record"
  - Buscar y seleccionar tabla: **`Miembros Comite SST`** (la tabla existente)
  - **NO** permitir linking a múltiples records
  - Nombre del campo en Miembros Comite SST: puede ser cualquiera (ej: "asistencias")
- **Propósito:** FK al miembro del comité

---

### Campo 5: COMITE
- **Nombre:** `COMITE`
- **Tipo:** Single select
- **Configuración:**
  - Click en "+" → "Single select"
  - Agregar opciones:
    - Opción 1: `COPASST` (color: azul)
    - Opción 2: `COCOLAB` (color: verde)
- **Propósito:** Discriminador para saber a qué comité pertenece

---

### Campo 6: ASISTIO
- **Nombre:** `ASISTIO`
- **Tipo:** Checkbox
- **Configuración:**
  - Click en "+" → "Checkbox"
  - **NO** marcar "Default to checked"
- **Propósito:** Indica si el miembro confirmó asistencia

---

### Campo 7: FIRMA ⭐
- **Nombre:** `FIRMA`
- **Tipo:** Long text
- **Configuración:**
  - Click en "+" → "Long text"
  - **Habilitar** "Enable rich text formatting" → **NO** (dejar deshabilitado)
- **Propósito:** Almacena el data URL de la firma (canvas base64)
- **Ejemplo de valor:** `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...`

---

### Campo 8: FECHA_FIRMA ⭐
- **Nombre:** `FECHA_FIRMA`
- **Tipo:** Date
- **Configuración:**
  - Click en "+" → "Date"
  - **Date format:** Local (Colombia)
  - **Include time:** ✅ SÍ (activar)
  - **Time format:** 24 hour
  - **GMT:** GMT-5 (Bogotá)
- **Propósito:** Timestamp de cuándo firmó el asistente

---

### Campo 9: OBSERVACIONES
- **Nombre:** `OBSERVACIONES`
- **Tipo:** Long text
- **Configuración:**
  - Click en "+" → "Long text"
  - Rich text: NO
- **Propósito:** Notas opcionales (ej: "Firmó tarde", "Salió temprano")

---

## PASO 3: Verificar Tabla Creada

Tu tabla debe verse así:

| ID_ASISTENCIA | ACTA_COPASST_LINK | ACTA_COCOLAB_LINK | MIEMBRO_LINK | COMITE | ASISTIO | FIRMA | FECHA_FIRMA | OBSERVACIONES |
|---|---|---|---|---|---|---|---|---|
| (vacío) | (vacío) | (vacío) | (vacío) | (vacío) | ☐ | (vacío) | (vacío) | (vacío) |

**✅ CHECKPOINT:** Confirma que tienes exactamente 9 campos con los nombres y tipos correctos.

---

## PASO 4: Obtener Field IDs (CRÍTICO)

Necesitamos extraer los **Field IDs** de Airtable para configurar el `.env`.

### Método 1: Desde la UI de Airtable (recomendado)

1. En la tabla `asistencia_comites`, haz click derecho en el nombre de cualquier campo
2. Selecciona **"Copy field ID"**
3. Pega en un archivo temporal para guardar

Repite para **cada uno de los 9 campos**.

### Método 2: Desde el API (más rápido)

Ejecuta este comando en tu terminal:

```bash
curl "https://api.airtable.com/v0/meta/bases/${AIRTABLE_SGSST_BASE_ID}/tables" \
  -H "Authorization: Bearer ${AIRTABLE_SGSST_API_TOKEN}" \
  | grep -A 50 "asistencia_comites"
```

Busca la tabla `asistencia_comites` en el JSON y copia los `id` de cada campo.

### Método 3: Usando script Node.js (yo te lo proporciono)

Si prefieres, puedo crear un script que automáticamente extraiga todos los Field IDs.

---

## PASO 5: Crear Archivo con Field IDs

Crea un archivo temporal `field-ids-asistencia.txt` con este formato:

```
ASISTENCIA_COMITES_TABLE_ID=tblXXXXXXXXXXXXXXX
ASISTENCIA_COMITES_ID_FIELD=fldXXXXXXXXXXXXXXX
ASISTENCIA_COMITES_ACTA_COPASST_LINK_FIELD=fldXXXXXXXXXXXXXXX
ASISTENCIA_COMITES_ACTA_COCOLAB_LINK_FIELD=fldXXXXXXXXXXXXXXX
ASISTENCIA_COMITES_MIEMBRO_LINK_FIELD=fldXXXXXXXXXXXXXXX
ASISTENCIA_COMITES_COMITE_FIELD=fldXXXXXXXXXXXXXXX
ASISTENCIA_COMITES_ASISTIO_FIELD=fldXXXXXXXXXXXXXXX
ASISTENCIA_COMITES_FIRMA_FIELD=fldXXXXXXXXXXXXXXX
ASISTENCIA_COMITES_FECHA_FIRMA_FIELD=fldXXXXXXXXXXXXXXX
ASISTENCIA_COMITES_OBSERVACIONES_FIELD=fldXXXXXXXXXXXXXXX
```

Reemplaza las `XXX` con los IDs reales que copiaste.

---

## PASO 6: Verificar Relaciones (IMPORTANTE)

Después de crear la tabla, verifica que se crearon automáticamente estos campos en las tablas relacionadas:

### En tabla `copasst_actas`:
- Debe aparecer un nuevo campo: **`asistencia_link`** (o similar)
- Tipo: Link to another record → asistencia_comites

### En tabla `cocolab_actas`:
- Debe aparecer un nuevo campo: **`asistencia_link`** (o similar)
- Tipo: Link to another record → asistencia_comites

### En tabla `Miembros Comite SST`:
- Debe aparecer un nuevo campo (puede tener cualquier nombre)
- Tipo: Link to another record → asistencia_comites

**✅ CHECKPOINT:** Si no ves estos campos, la relación no se creó correctamente.

---

## PASO 7: Registro de Prueba (Opcional pero Recomendado)

Crea un registro de prueba para validar:

1. En la tabla `asistencia_comites`, agrega una fila:
   - `ID_ASISTENCIA`: `TEST-001`
   - `COMITE`: `COPASST`
   - `ASISTIO`: ✅ marcado
   - `FIRMA`: `data:image/png;base64,iVBORw0KGgo=` (cualquier texto que empiece con `data:image`)
   - `FECHA_FIRMA`: Fecha/hora actual

2. Vincula a un miembro de prueba en `MIEMBRO_LINK`

3. Verifica que:
   - El campo `asistencia_link` en `copasst_actas` muestra el vínculo
   - El campo en `Miembros Comite SST` muestra el vínculo

**Si todo funciona, ELIMINA el registro de prueba.**

---

## PASO 8: Notificarme

Una vez completado, envíame:

1. ✅ Confirmación de que la tabla está creada
2. 📄 El archivo `field-ids-asistencia.txt` con los 10 Field IDs
3. ⚠️ Cualquier error o duda que hayas encontrado

**Yo me encargaré de:**
- Actualizar `.env` y `.env.example`
- Configurar `airtableSGSST.ts`
- Refactorizar `actasRepository.ts`
- Implementar endpoint API de firma
- Actualizar UI con botones de firma

---

## 🚨 TROUBLESHOOTING

### Problema: No puedo encontrar la tabla "Miembros Comite SST"
**Solución:** Verifica que estés en la base correcta "Sirius SG-SST". La tabla existe según el análisis previo (ID: `tbl6bA8ZA7WVOckHI`).

### Problema: El campo "Link to another record" no me deja seleccionar la tabla
**Solución:** Asegúrate de tener permisos de escritura en la base. Si no, contacta al administrador.

### Problema: No sé cómo copiar Field IDs
**Solución:** Usa el Método 3 (script) que yo te proporciono, o dime y te ayudo a extraerlos remotamente.

---

## ⏱️ TIEMPO ESTIMADO TOTAL: 10-15 minutos

**¡Avísame cuando termines para proceder con la implementación del código!**
