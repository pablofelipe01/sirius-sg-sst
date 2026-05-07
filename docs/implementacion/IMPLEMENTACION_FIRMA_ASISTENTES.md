# Implementación de Firma Individual por Asistente - Comités SST

## Resumen

Se implementó un sistema de firma digital individual para cada asistente de las reuniones de COPASST y COCOLAB. **Las firmas se capturan durante el formulario de creación del acta**, permitiendo que todos los asistentes firmen antes de guardar el documento.

## Flujo de Usuario

### Creación de Acta con Firmas
1. Usuario va a `/dashboard/comites/[comite]/nueva`
2. Llena datos generales (fecha, hora, lugar, etc.)
3. **Marca asistentes y cada uno puede firmar inmediatamente:**
   - Checkbox marcado → aparece botón "Firmar"
   - Click en "Firmar" → modal con canvas
   - Usuario firma → "Confirmar Firma" → firma se almacena temporalmente
   - Badge "✓ Firmado" aparece en la tabla
4. Completa resto del formulario (accidentes, compromisos, etc.)
5. Click en "Guardar borrador" → todas las firmas se envían junto con el acta
6. Backend crea acta + registros de asistencia con firmas incluidas
7. Redirige a vista de detalle del acta

### Firma Posterior (Opcional)
Para asistentes que no firmaron durante la creación:
1. Usuario abre acta existente en borrador en `/dashboard/comites/[comite]/[idActa]`
2. Ve tabla de asistentes con columna "Firma"
3. Para asistentes SIN firma aparece botón "Firmar"
4. Click → abre modal → firma → POST a `/api/[comite]/actas/[id]/firmar-asistente`
5. Backend actualiza solo el campo `firma` y `fecha_firma`
6. Página recarga, muestra "✓ Firmado"

### Firma del Acta Completa (Presidente + Secretario)
1. Cuando todos firmaron (o no), click "Firmar acta"
2. Modal doble para presidente y secretario (flujo existente)
3. Backend marca acta como `estado=firmada`
4. Se genera PDF con todas las firmas

## Arquitectura

### Tabla Intermedia en Airtable

Se creó la tabla **`asistencia_comites`** para almacenar la relación muchos-a-muchos entre actas y miembros, con campos adicionales de firma:

**Campos de la tabla:**
- `id_asistencia` (autonumber) - ID único del registro
- `acta_copasst_link` (Link to COPASST_actas) - FK opcional a acta COPASST
- `acta_cocolab_link` (Link to COCOLAB_actas) - FK opcional a acta COCOLAB
- `miembro_link` (Link to Miembros Comite SST) - FK al miembro
- `comite` (Single select) - Discriminador: "COPASST" | "COCOLAB"
- `asistio` (Checkbox) - Si asistió o no
- `firma` (Long text) - Data URL de la firma (base64 PNG)
- `fecha_firma` (Date & time) - Timestamp de cuándo firmó
- `observaciones` (Long text) - Notas adicionales

**Justificación del diseño:**
- Permite atributos por asistencia (firma, fecha)
- Soporta ambos comités en una sola tabla (discriminador + FK duales)
- Independiza la firma del catálogo de miembros (histórico correcto)

## Archivos Modificados/Creados

### 1. **src/lib/comites/types.ts** ✅
Agregados 3 campos a la interfaz `AsistenteActa`:
```typescript
firma?: string | null;        // Data URL del canvas
fechaFirma?: string | null;   // ISO timestamp
observaciones?: string | null;
```

### 2. **src/infrastructure/config/airtableSGSST.ts** ✅
Configuración completa de la tabla y sus 9 field IDs.

### 3. **.env.example** ✅
10 variables de entorno agregadas para la tabla `asistencia_comites`.

### 4. **.env.local** ✅
Field IDs reales extraídos de Airtable:
- Table ID: `tblp76ukIgJxYgWZG`
- 9 field IDs configurados

### 5. **src/lib/comites/actasRepository.ts** ✅
**Refactorización completa:**

**Nueva función:**
```typescript
async function fetchAsistenciasByActa(
  comite: ComiteTipo,
  actaRecordId: string
): Promise<AsistenteActa[]>
```
- Query a `asistencia_comites` filtrando por comité y acta
- Join con `Miembros Comite SST` para obtener datos derivados
- Retorna array con firma y fechaFirma incluidos

**Nueva función:**
```typescript
export async function firmarAsistencia(
  comite: ComiteTipo,
  idActa: string,
  miembroRecordId: string,
  firmaDataUrl: string
): Promise<void>
```
- Valida que el acta existe y no está firmada (estado borrador)
- Valida que el asistente tiene `asistio=true`
- Actualiza campos FIRMA y FECHA_FIRMA
- Lanza error si no se encuentra el registro o no cumple condiciones

**Funciones modificadas:**
- `obtenerActaPorId()` - Ahora usa `fetchAsistenciasByActa()` en lugar de lectura directa
- `crearActa()` - Inserta registros en `asistencia_comites` (no usa ASISTENTES_LINK)
- `actualizarActa()` - Borra y recrea registros de asistencia al actualizar

### 6. **src/app/api/copasst/actas/[id]/firmar-asistente/route.ts** ✅
**Endpoint POST:**
- Body: `{ miembroRecordId: string, firma: string }`
- Validaciones: formato data URL, campos requeridos
- Llama a `firmarAsistencia()` del repository
- Retorna: `{ success: true, message: "..." }`

### 7. **src/app/api/cocolab/actas/[id]/firmar-asistente/route.ts** ✅
Idéntico al de COPASST (endpoints separados por convención del proyecto).

### 8. **src/presentation/components/comites/AsistenteFirmaModal.tsx** ✅
**Componente React de 280 líneas con dos modos:**

**Props:**
```typescript
{
  isOpen: boolean;
  onClose: () => void;
  miembroNombre: string;
  miembroCedula: string;
  miembroCargo: string;
  miembroRecordId: string;
  onFirmaGuardada: () => void;
  comite: "copasst" | "cocolab";
  actaId?: string;                    // Opcional - determina modo
  onFirmaCapturada?: (recordId, firma) => void; // Callback modo offline
}
```

**Modos de operación:**
- **Modo Offline** (sin actaId): Captura firma y la retorna vía callback sin guardar en API
- **Modo Online** (con actaId): Captura firma y hace POST al endpoint API

**Funcionalidades:**
- Canvas HTML5 (400×150px) para firma con mouse y touch
- Validación de firma no vacía (verifica píxeles no blancos)
- Botón "Limpiar" para reiniciar el canvas
- Conversión a PNG data URL (base64)
- UI glass-morphism dark (consistente con el resto del sistema)

### 9. **src/app/dashboard/comites/[comite]/nueva/page.tsx** ✅
**Página de creación de acta - Captura de firmas integrada:**

**Cambios:**
- Importado `AsistenteFirmaModal` y ícono `CheckCircle2`
- Agregados estados:
  - `firmasMap: Record<string, string>` - Almacena firmas temporalmente (recordId → dataURL)
  - `modalAsistente: Miembro | null` - Controla modal abierto
- Agregada columna "Firma" a la tabla de asistentes con lógica:
  - Si no está marcado: celda vacía
  - Si está marcado Y ya firmó: badge "✓ Firmado" (verde)
  - Si está marcado Y NO firmó: botón "Firmar" (azul)
- Modal renderizado en modo offline (sin actaId)
- Al confirmar firma: `setFirmasMap({ ...firmasMap, [recordId]: firmaDataUrl })`
- En submit: `asistentesConFirmas` incluye `firma` de cada asistente
- Si se desmarca checkbox: firma se limpia automáticamente

### 10. **src/app/dashboard/comites/[comite]/[id]/page.tsx** ✅
**Página de detalle de acta - Firmas posteriores (opcional):**

**Cambios:**
- Importado `AsistenteFirmaModal` y ícono `UserCheck`
- Actualizada interfaz `Acta` con campos `firma` y `fechaFirma` en asistentes
- Agregado estado `modalAsistente` para controlar modal
- Agregada columna "Firma" a la tabla de asistentes
- Lógica condicional por asistente:
  - Si no asistió: celda vacía
  - Si asistió y ya firmó: badge "✓ Firmado" (verde)
  - Si asistió y NO firmó: botón "Firmar" (azul)
- Modal renderizado en modo online (con actaId) que hace POST al API
- Al cerrar modal: recarga acta con `cargar()`

### 11. **src/lib/comites/handlers.ts** ✅
**Handler de creación actualizado para soportar firmas:**

**Cambios en `handleCrear`:**
- Validación flexible: acepta `asistentesConFirmas` O `asistentesRecordIds`
- Backward compatibility mantenida para código legacy

### 12. **src/lib/comites/actasRepository.ts** ✅
**Repository actualizado - dual support:**

**Tipo `CrearActaPayload` modificado:**
```typescript
export interface CrearActaPayload {
  // ... campos existentes ...
  asistentesRecordIds?: string[];  // Legacy (opcional)
  asistentesConFirmas?: Array<{    // Nuevo formato (opcional)
    recordId: string;
    asistio: boolean;
    firma?: string | null;
  }>;
}
```

**Función `crearActa()` modificada:**
- Normaliza ambos formatos al inicio:
  ```typescript
  const asistentes = payload.asistentesConFirmas ||
    (payload.asistentesRecordIds?.map(id => ({ 
      recordId: id, asistio: true, firma: null 
    })) || []);
  ```
- Si asistente tiene `firma`, agrega campos `FIRMA` y `FECHA_FIRMA` al insertar
- Timestamp automático cuando hay firma

## Flujo de Usuario

### Creación de Acta
1. Usuario va a `/dashboard/comites/[comite]/nueva`
2. Llena datos, marca asistentes
3. Guarda → se crean registros en `asistencia_comites` con `asistio=true` y `firma=null`
4. Redirige a `/dashboard/comites/[comite]/[idActa]`

### Firma Individual
1. Usuario abre acta existente en borrador
2. Ve tabla de asistentes con columna "Firma"
3. Para cada asistente SIN firma aparece botón "Firmar"
4. Clic → abre modal con canvas
5. Usuario firma con mouse/táctil → botón "Confirmar Firma"
6. POST a `/api/[comite]/actas/[id]/firmar-asistente`
7. Backend actualiza `firma` (data URL) y `fecha_firma` (timestamp)
8. Modal cierra, página recarga, ahora muestra "✓ Firmado"

### Firma del Acta Completa (Presidente + Secretario)
1. Cuando todos firmaron (o no), click "Firmar acta"
2. Modal doble para presidente y secretario (ya existía)
3. Backend marca acta como `estado=firmada`
4. Se genera PDF con todas las firmas (incluidas individuales)

## Validaciones Implementadas

### Backend
- Formato nuevo vs legacy: acepta ambos con validación flexible
- Si usa formato nuevo: valida estructura de `asistentesConFirmas`
- Si usa formato legacy: valida `asistentesRecordIds`
- Firma debe ser data URL válido (`data:image/...`) si está presente
- Al firmar posteriormente: acta debe estar en estado `borrador`
- Al firmar posteriormente: asistente debe tener `asistio=true`

### Frontend
- Canvas debe tener al menos un píxel dibujado (no blanco)
- Al desmarcar asistente: firma se limpia automáticamente
- Validación de lugar seleccionado antes de submit

## Variables de Entorno Requeridas

Agregar al `.env.local` (ya están en `.env.example`):

```bash
ASISTENCIA_COMITES_TABLE_ID=tblp76ukIgJxYgWZG
ASISTENCIA_COMITES_ID_FIELD=flda6Np9aLSY8wqmH
ASISTENCIA_COMITES_ACTA_COPASST_LINK_FIELD=fldJAAtvHxqhO4Wsd
ASISTENCIA_COMITES_ACTA_COCOLAB_LINK_FIELD=fldIbnXeU65QrJjJp
ASISTENCIA_COMITES_MIEMBRO_LINK_FIELD=fldXCOn8G9hCEgC3p
ASISTENCIA_COMITES_COMITE_FIELD=fldDSouglX9nvJjPI
ASISTENCIA_COMITES_ASISTIO_FIELD=fldEBFRfmsiK06R5Q
ASISTENCIA_COMITES_FIRMA_FIELD=fld9ntGBRMiVJLa8T
ASISTENCIA_COMITES_FECHA_FIRMA_FIELD=fldbScbecJPhIZp5U
ASISTENCIA_COMITES_OBSERVACIONES_FIELD=fldp9eIru5MHGZth8
```

## Scripts de Utilidad

### `scripts/extraer-field-ids-asistencia.js`
Script Node.js para extraer Field IDs de la tabla en Airtable:
```bash
AIRTABLE_API_TOKEN=xxx AIRTABLE_BASE_ID=xxx node scripts/extraer-field-ids-asistencia.js
```

## Próximos Pasos

### Funcionalidades Futuras (Opcionales)
1. **Exportación PDF con firmas individuales** - Agregar imágenes de firmas al PDF del acta
2. **Editar firma** - Permitir reemplazar firma si hubo error (requiere validación)
3. **Firma con certificado digital** - Integración con firma electrónica con validez legal
4. **Notificaciones** - Email/notificación cuando alguien firma (solo en modo posterior)
5. **Auditoría** - Dashboard de firmas pendientes por acta

### Posibles Mejoras
1. **Contador de firmas** - Mostrar "3/5 firmados" en header de formulario
2. **Validación opcional** - Opción para requerir todas las firmas antes de guardar
3. **Compresión de imágenes** - Reducir tamaño de data URLs para optimizar almacenamiento
4. **Firma en tablet** - UI optimizada para dispositivos táctiles grandes

## Documentos de Análisis

Ver también:
- `ANALISIS_ASISTENCIA_COMITES.md` - Análisis completo de arquitectura y decisiones
- `GUIA_CREAR_TABLA_ASISTENCIA_COMITES.md` - Guía paso a paso para crear la tabla

## Estado

✅ **COMPLETADO** - Sistema funcional end-to-end con doble flujo

**Flujo Principal (Recomendado):**
- ✅ Firmas durante creación de acta (modo offline)
- ✅ Almacenamiento temporal en estado React
- ✅ Envío batch con payload de creación
- ✅ Inserción atómica en Airtable

**Flujo Secundario (Opcional):**
- ✅ Firmas posteriores en acta existente (modo online)  
- ✅ Endpoint API individual por asistente
- ✅ Actualización incremental

**Documentación:**
- ✅ Base de datos configurada en Airtable
- ✅ Backend (API + repository) con dual support
- ✅ Frontend (modal + 2 integraciones) completado
- ✅ Variables de entorno configuradas
- ✅ Backward compatibility mantenida

**Última actualización:** 2026-04-30 (Migrado a flujo de captura durante creación)
