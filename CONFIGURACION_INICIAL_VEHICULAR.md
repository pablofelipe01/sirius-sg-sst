# ⚠️ Configuración Inicial Requerida — Módulo Vehicular

**Estado actual:** ❌ **Sin configurar** (0% de variables de entorno)

El módulo de seguimiento vehicular está **implementado y funcional**, pero requiere configuración de Airtable antes de poder usarlo.

---

## 🚨 Error Actual

```
GET /api/sgsst/vehicular 403 Forbidden
{"error":"Error al consultar vehículos"}
```

**Causa:** Las tablas de Airtable (`veh_vehiculos`, `veh_documentos`, `veh_licencias`, `veh_alertas_log`) **no existen todavía** en tu base de datos.

---

## ✅ Solución Rápida (30 minutos)

### Opción 1: Configuración Completa (Recomendada)

Sigue la **GUIA_RAPIDA_VEHICULAR.md** paso a paso:

1. **Crear tablas en Airtable** (15 min)
   - Abrir base SG-SST: https://airtable.com/appBU8J9xGIFJSOVc
   - Crear 4 tablas: `veh_vehiculos`, `veh_documentos`, `veh_licencias`, `veh_alertas_log`
   - Usar estructura definida en `GUIA_RAPIDA_VEHICULAR.md`

2. **Copiar Field IDs** (10 min)
   - Clic derecho en cada campo → "Copy field ID"
   - Pegar en `.env.local`

3. **Agregar variables a `.env.local`** (5 min)
   ```bash
   # Copiar sección del módulo vehicular desde .env.example
   # Reemplazar valores `tbl_xxx` y `fld_xxx` con IDs reales
   ```

4. **Reiniciar servidor**
   ```bash
   # Detener servidor (Ctrl+C)
   npm run dev
   ```

### Opción 2: Usar Datos de Demo (Rápido)

Si solo quieres **ver la UI funcionando** sin datos reales:

```bash
# Endpoint de diagnóstico (sin autenticación)
curl http://localhost:3001/api/sgsst/vehicular/diagnostico
```

Este endpoint muestra el estado de configuración y pasos siguientes.

---

## 📊 Estado de Configuración

Puedes verificar el estado en cualquier momento visitando:

**http://localhost:3001/api/sgsst/vehicular/diagnostico**

Ejemplo de respuesta:
```json
{
  "estado": "❌ Sin configurar",
  "configuracion": {
    "tablas": {
      "vehiculos": "❌ Faltante",
      "documentos": "❌ Faltante",
      "licencias": "❌ Faltante",
      "alertas": "❌ Faltante"
    }
  },
  "pasosSiguientes": [
    "1. Crear las 4 tablas en Airtable",
    "2. Copiar los field IDs",
    "3. Agregar a .env.local",
    "4. Reiniciar servidor"
  ]
}
```

Cuando esté configurado correctamente verás:
```json
{
  "estado": "✅ Configuración completa"
}
```

---

## 🔧 Estructura Mínima para Pruebas Rápidas

Si quieres empezar rápido, crea solo la tabla `veh_vehiculos` con estos campos:

### Tabla: `veh_vehiculos`

| Campo | Tipo | Fórmula/Valor |
|---|---|---|
| `id` | Formula | `RECORD_ID()` |
| `ID_Personal_Core` | Single line text | |
| `Placa` | Single line text | |
| `Tipo_Vehiculo` | Single select | Motocicleta, Automóvil, Camioneta |
| `Propietario_Nombre` | Single line text | |
| `Propietario_Tipo` | Single select | Colaborador, Tercero |
| `Activo` | Checkbox | ☑ Default checked |

Luego agrega **solo estas 8 variables** a `.env.local`:

```bash
AIRTABLE_VEH_VEHICULOS_TABLE_ID=tblXXXXXXXXXXXX
AIRTABLE_VEH_VEH_ID=fldXXXXXXXXXXXX
AIRTABLE_VEH_VEH_ID_PERSONAL_CORE=fldXXXXXXXXXXXX
AIRTABLE_VEH_VEH_PLACA=fldXXXXXXXXXXXX
AIRTABLE_VEH_VEH_TIPO_VEHICULO=fldXXXXXXXXXXXX
AIRTABLE_VEH_VEH_PROPIETARIO_NOMBRE=fldXXXXXXXXXXXX
AIRTABLE_VEH_VEH_PROPIETARIO_TIPO=fldXXXXXXXXXXXX
AIRTABLE_VEH_VEH_ACTIVO=fldXXXXXXXXXXXX
```

Con esto ya podrás **ver vehículos en la tabla** (aunque sin documentos ni licencias).

---

## 📖 Documentación Disponible

| Archivo | Descripción | Tiempo |
|---|---|---|
| **GUIA_RAPIDA_VEHICULAR.md** | Setup completo paso a paso | 30 min |
| **MODULO_VEHICULAR_IMPLEMENTACION.md** | Detalles técnicos | Referencia |
| **RESUMEN_MODULO_VEHICULAR.md** | Manual de usuario | Referencia |

---

## 🐛 Solución de Problemas

### Error: "Cannot read properties of undefined"
**Causa:** Variable de entorno faltante  
**Solución:** Verificar que todas las variables de `.env.example` estén en `.env.local`

### Error: "404 Not Found" en Airtable
**Causa:** Table ID o Field ID incorrecto  
**Solución:** Copiar de nuevo los IDs desde Airtable

### Panel carga pero muestra "0 vehículos"
✅ **Esto es normal si acabas de configurar.** Debes registrar el primer vehículo.

---

## ✨ Una Vez Configurado

Después de seguir los pasos anteriores, podrás:

1. ✅ Ver el panel en http://localhost:3001/dashboard/sgsst/vehicular
2. ✅ Registrar vehículos con validación de placas
3. ✅ Agregar documentos SOAT y tecnomecánica
4. ✅ Registrar licencias de conducción
5. ✅ Recibir alertas automáticas de vencimientos

---

## 🚀 Empezar Ahora

```bash
# 1. Verificar estado actual
curl http://localhost:3001/api/sgsst/vehicular/diagnostico | jq .

# 2. Seguir guía de configuración
open GUIA_RAPIDA_VEHICULAR.md

# 3. Una vez configurado, probar
curl http://localhost:3001/api/sgsst/vehicular
```

---

**¿Necesitas ayuda?** Revisa la sección "Problemas Comunes" en `RESUMEN_MODULO_VEHICULAR.md`

*Documento generado automáticamente por el sistema de diagnóstico*
