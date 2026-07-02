# Fix: Campo "ID Empleado" (SIRIUS-PER-XXXX) en Airtable

**Fecha:** 2026-07-02  
**Módulo:** Personal / Nómina Core  
**Tipo:** Configuración de Airtable

## 🔴 Problema Identificado

El campo `"ID Empleado"` en la tabla **Personal** de Airtable tiene el mismo valor para todos los registros: `SIRIUS-PER-0001`.

**Impacto:**
- Todos los empleados tienen el mismo ID
- Inducciones registradas con el mismo `idEmpleadoCore`
- Imposible distinguir entre empleados
- FK simbólicas no funcionan correctamente

## 🔍 Causa Raíz

El campo `"ID Empleado"` en Airtable debe ser:
- **Texto autoincremental** con fórmula
- **Único por registro**
- **Formato:** `SIRIUS-PER-XXXX` (donde XXXX es el número secuencial)

### Configuración Actual (Incorrecta)

El campo probablemente está configurado como:
- Tipo: Texto plano
- Valor: Manualmente ingresado o copiado
- Resultado: Todos los registros tienen `SIRIUS-PER-0001`

## ✅ Solución: Configurar Fórmula Autoincremental en Airtable

### Opción 1: Fórmula con RECORD_ID() (Recomendado)

Esta es la solución más simple y no requiere cambios en múltiples campos.

**Pasos:**

1. **Ir a la tabla Personal en Airtable**

2. **Crear un nuevo campo (si no existe) o modificar el existente:**
   - Nombre: `ID Empleado`
   - Tipo: **Formula**

3. **Configurar la fórmula:**
```javascript
CONCATENATE(
  "SIRIUS-PER-",
  RIGHT(
    CONCATENATE(
      "0000",
      RECORD_ID()
    ),
    4
  )
)
```

**Esta fórmula:**
- Toma el `RECORD_ID()` de Airtable (que es único y autoincremental)
- Agrega ceros a la izquierda para tener 4 dígitos
- Concatena con el prefijo `SIRIUS-PER-`
- Resultado: `SIRIUS-PER-0001`, `SIRIUS-PER-0002`, etc.

**⚠️ Limitación:** El número no será secuencial si se eliminan registros (tendrás gaps). Pero es único y funcional.

### Opción 2: Fórmula con Autonumber (Más control)

Si quieres control total del número secuencial:

1. **Crear un campo Autonumber:**
   - Nombre: `Número Secuencial`
   - Tipo: **Autonumber**

2. **Crear campo de fórmula para ID Empleado:**
   - Nombre: `ID Empleado`
   - Tipo: **Formula**

3. **Configurar la fórmula:**
```javascript
CONCATENATE(
  "SIRIUS-PER-",
  RIGHT(
    CONCATENATE(
      "0000",
      {Número Secuencial}
    ),
    4
  )
)
```

**Esta fórmula:**
- Usa el campo Autonumber (secuencial sin gaps)
- Formatea a 4 dígitos con ceros a la izquierda
- Concatena con el prefijo `SIRIUS-PER-`
- Resultado: `SIRIUS-PER-0001`, `SIRIUS-PER-0002`, `SIRIUS-PER-0003` (sin gaps)

### Opción 3: Script de Migración (Para corregir registros existentes)

Si ya tienes muchos registros y quieres renumerarlos:

```javascript
// Script de Airtable (Scripting Block)
let table = base.getTable("Personal");
let query = await table.selectRecordsAsync();

let updates = [];
let contador = 1;

for (let record of query.records) {
  const nuevoId = `SIRIUS-PER-${String(contador).padStart(4, '0')}`;
  updates.push({
    id: record.id,
    fields: {
      "ID Empleado": nuevoId
    }
  });
  contador++;
}

// Actualizar en lotes de 50
while (updates.length > 0) {
  const batch = updates.splice(0, 50);
  await table.updateRecordsAsync(batch);
  console.log(`Actualizados ${batch.length} registros`);
}

console.log("✅ Migración completada");
```

## 📋 Plan de Implementación

### Fase 1: Backup
```bash
# 1. Exportar tabla Personal desde Airtable
#    Airtable > Personal > ... > Export to CSV
# 2. Guardar backup local con fecha
```

### Fase 2: Aplicar Solución

**Opción A (Rápida - Recomendada):**
1. Ir a Airtable → Base Personal → Tabla Personal
2. Modificar campo `ID Empleado` → Cambiar a **Formula**
3. Pegar fórmula con `RECORD_ID()` (ver Opción 1)
4. Verificar que todos los registros tengan IDs únicos

**Opción B (Secuencial sin gaps):**
1. Crear campo `Número Secuencial` tipo **Autonumber**
2. Crear/Modificar campo `ID Empleado` tipo **Formula**
3. Pegar fórmula con `{Número Secuencial}` (ver Opción 2)
4. Verificar IDs secuenciales

### Fase 3: Verificación

**En Airtable:**
```
# Verificar que cada registro tenga un ID único
# Ordenar por "ID Empleado" y verificar secuencia
# Buscar duplicados visualmente
```

**En la aplicación:**
```bash
# 1. Ir a /dashboard/inducciones
# 2. Ver lista de colaboradores
# 3. Verificar que cada uno tenga un ID diferente
# 4. Crear inducción de prueba → verificar ID correcto
```

### Fase 4: Actualizar Registros Existentes (Si aplica)

Si ya tienes inducciones/registros con `SIRIUS-PER-0001` duplicado:

1. **Identificar registros afectados:**
```bash
# En Airtable, filtrar tabla "ind_registros"
# Filtro: ID_Empleado_CORE = "SIRIUS-PER-0001"
# Contar registros
```

2. **Actualizar manualmente o con script:**
```javascript
// Si son pocos registros, actualizar manualmente desde UI
// Si son muchos, usar script de Airtable para re-asignar IDs correctos
```

## 🎯 Resultado Esperado

### Antes ❌
```
Personal:
┌─────────────┬──────────────────┬─────────────────┐
│ Record ID   │ Nombre           │ ID Empleado     │
├─────────────┼──────────────────┼─────────────────┤
│ rec001      │ Juan Pérez       │ SIRIUS-PER-0001 │ ❌
│ rec002      │ María García     │ SIRIUS-PER-0001 │ ❌ DUPLICADO
│ rec003      │ Carlos López     │ SIRIUS-PER-0001 │ ❌ DUPLICADO
└─────────────┴──────────────────┴─────────────────┘
```

### Después ✅
```
Personal:
┌─────────────┬──────────────────┬─────────────────┐
│ Record ID   │ Nombre           │ ID Empleado     │
├─────────────┼──────────────────┼─────────────────┤
│ rec001      │ Juan Pérez       │ SIRIUS-PER-0001 │ ✅
│ rec002      │ María García     │ SIRIUS-PER-0002 │ ✅
│ rec003      │ Carlos López     │ SIRIUS-PER-0003 │ ✅
└─────────────┴──────────────────┴─────────────────┘

Inducciones:
┌─────────────┬──────────────────┬─────────────────┐
│ ID_Induccion│ Nombre           │ ID_Empleado_CORE│
├─────────────┼──────────────────┼─────────────────┤
│ IND-0001    │ Juan Pérez       │ SIRIUS-PER-0001 │ ✅
│ IND-0002    │ María García     │ SIRIUS-PER-0002 │ ✅
│ IND-0003    │ Carlos López     │ SIRIUS-PER-0003 │ ✅
└─────────────┴──────────────────┴─────────────────┘
```

## ⚠️ Consideraciones Importantes

### 1. Campo de Solo Lectura
Una vez configurado como **Formula**, el campo será **read-only** en Airtable. Esto es correcto y deseado.

### 2. Integridad Referencial
Después de cambiar los IDs, los registros relacionados (inducciones, entregas EPP, etc.) seguirán usando `SIRIUS-PER-0001`. Necesitarás actualizarlos manualmente o con script.

### 3. Nuevos Registros
Los nuevos empleados que agregues a Personal **automáticamente** recibirán un ID único gracias a la fórmula.

### 4. Record ID vs ID Empleado
- `Record ID` (rec...): ID interno de Airtable (inmutable)
- `ID Empleado` (SIRIUS-PER-XXXX): ID de negocio visible al usuario

El código ya maneja ambos (ver `airtableNominaRepository.ts:158`):
```typescript
const idEmpleado = (r.fields["ID Empleado"] as string) || r.id;
```

## 📚 Referencias

- **Airtable Formula Field:** https://support.airtable.com/docs/formula-field-reference
- **Autonumber Field:** https://support.airtable.com/docs/autonumber-field
- **RECORD_ID():** https://support.airtable.com/docs/record-id-function

## 🔧 Testing

### Test 1: Verificar IDs Únicos en Personal
```bash
1. Abrir Airtable → Personal
2. Ver todos los registros
3. Verificar que cada "ID Empleado" sea diferente
4. No debe haber duplicados
```

### Test 2: Crear Nueva Inducción
```bash
1. Ir a /dashboard/inducciones/nueva
2. Seleccionar empleado
3. Crear inducción
4. Verificar en Airtable que idEmpleadoCore sea correcto
```

### Test 3: Generar Link de Firma
```bash
1. Ir al historial de una inducción
2. Generar link de firma
3. Verificar que URL contenga el ID correcto
```

## 🎯 Checklist de Implementación

- [ ] Backup de tabla Personal exportado
- [ ] Campo "ID Empleado" configurado como Formula
- [ ] Fórmula aplicada y verificada
- [ ] Todos los registros tienen IDs únicos
- [ ] IDs siguen formato `SIRIUS-PER-XXXX`
- [ ] Nueva inducción usa ID correcto
- [ ] Dashboard muestra IDs únicos
- [ ] Link de firma incluye ID correcto

---

**✅ Una vez completado, el sistema funcionará correctamente con IDs únicos.**

**⏱️ Tiempo estimado:** 10-15 minutos (incluye backup y verificación)
