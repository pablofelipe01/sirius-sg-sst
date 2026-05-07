# FIX — Error CORS al subir fotos de evidencia en Entrega EPP

**Fecha:** 2026-05-07  
**Módulo:** `inventario-epp/entrega`  
**Severidad:** Alta — las fotos de evidencia no se guardaban  
**Estado:** ✅ Resuelto

---

## Síntoma

Al registrar una nueva entrega EPP con fotos de evidencia, la subida fallaba silenciosamente:

```
[browser] Error subiendo fotos de evidencia: TypeError: Failed to fetch
    at handleSubmit (...)
```

El endpoint `/api/entregas-epp/foto-evidencia/presign` respondía `200` correctamente, pero el `PUT` directo al bucket S3 desde el navegador nunca llegaba.

---

## Causa raíz

El flujo original implementaba una **subida directa browser → S3** en 3 pasos:

```
1. POST /api/entregas-epp/foto-evidencia/presign  → obtener URL prefirmada
2. PUT  {presignedUrl} (fetch desde el navegador)  → subir imagen a S3 directo
3. POST /api/entregas-epp/foto-evidencia           → guardar keys en Airtable
```

El paso 2 fallaba porque el bucket S3 **no tenía configurada una política CORS** que permitiera `PUT` desde orígenes externos (el dominio de la app). Sin esa configuración, AWS rechaza cualquier solicitud `PUT` cross-origin desde el navegador con un error de red.

```
AWS S3 → bloquea PUT cross-origin → TypeError: Failed to fetch (sin status HTTP)
```

> **Nota:** El error no produce un status HTTP visible porque CORS falla antes de que el navegador envíe la solicitud real (preflight bloqueado o respuesta sin cabecera `Access-Control-Allow-Origin`).

---

## Solución aplicada

Se eliminaron los pasos 1 y 2 y se reemplazó por un **upload server-side** usando el mismo endpoint que ya funcionaba en el módulo de historial de entregas (`GestorFotos`):

```
ANTES (3 pasos, browser → S3 directo):
  POST /presign → PUT S3 (browser) → POST /foto-evidencia (json keys)

DESPUÉS (1 paso, servidor como proxy):
  POST /foto-evidencia (FormData) → servidor sube a S3 → guarda en Airtable
```

**Archivo modificado:** `src/app/dashboard/inventario-epp/entrega/page.tsx`

```typescript
// ANTES — flujo presigned URL (fallaba por CORS)
const presignRes = await fetch("/api/entregas-epp/foto-evidencia/presign", { ... });
const putRes = await fetch(upload.uploadUrl, { method: "PUT", body: foto }); // ❌ CORS
await fetch("/api/entregas-epp/foto-evidencia", { body: JSON.stringify({ s3Keys }) });

// DESPUÉS — FormData server-side (funciona)
const formData = new FormData();
formData.append("entregaRecordId", ent.entregaId);
todasLasFotos.forEach((foto) => formData.append("fotos", foto));
await fetch("/api/entregas-epp/foto-evidencia", { method: "POST", body: formData }); // ✅
```

El endpoint `/api/entregas-epp/foto-evidencia` ya soportaba `FormData` (Opción B) con validación completa de tipo y tamaño, upload a S3 y guardado en Airtable.

---

## Módulos relacionados que usan el mismo patrón seguro

Los siguientes módulos ya usaban upload server-side y **no tienen este problema**:

| Módulo | Endpoint | Método |
|--------|----------|--------|
| Historial Entregas EPP (`GestorFotos`) | `POST /api/entregas-epp/foto-evidencia/actualizar` | FormData server-side |
| Inspecciones Áreas | `POST /api/inspecciones-areas/fotos` | FormData server-side |
| Inspecciones Equipos | `POST /api/inspecciones-equipos/foto-equipo` | FormData server-side |

---

## Alternativa descartada

Configurar CORS en el bucket S3 para permitir `PUT` desde el navegador. Se descartó porque:

1. Requiere acceso a la consola AWS / IAM para modificar la política CORS del bucket.
2. Expone el bucket a más orígenes con permisos de escritura.
3. El patrón server-side ya existe y funciona — no agrega complejidad.

---

## Deuda técnica relacionada

El endpoint `/api/entregas-epp/foto-evidencia/presign` y la Opción A (JSON con S3 keys) del endpoint principal quedan sin uso activo. Se pueden conservar para futura implementación si se configura CORS correctamente en S3, o eliminar en una limpieza futura.
