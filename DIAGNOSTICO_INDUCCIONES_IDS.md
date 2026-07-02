# Diagnóstico: IDs Autoincrementales y URLs en Módulo Inducciones

**Fecha:** 2026-07-02  
**Módulo:** Inducciones y Reinducciones  
**Entorno:** Producción (https://sirius-sg-sst.vercel.app/dashboard/inducciones)

## 🔴 Problemas Identificados

### 1. IDs No Autoincrementales (PK/FK)

**Ubicación:** `src/infrastructure/repositories/airtableInduccionesRepository.ts:475-499`

**Código actual:**
```typescript
private async obtenerUltimoIdInduccion(): Promise<string | null> {
  const url = `${this.client.baseUrl}/${this.registrosTableId}`;
  const params = new URLSearchParams({
    sort: JSON.stringify([{field: RF.ID_INDUCCION, direction: 'desc'}]),
    maxRecords: "1",
  });
  
  const response = await fetch(`${url}?${params}`, {
    headers: this.client.headers,
  });
  
  const data = await response.json();
  const lastId = data.records.length > 0 ? data.records[0].fields[RF.ID_INDUCCION] : null;
  
  return lastId;
}
```

**Problema:**
- El sort por `field` ID puede no funcionar si el field ID no es sorteable en Airtable
- Airtable requiere usar el **nombre del campo** para sorting, no el field ID
- Misma lógica aplica para `obtenerUltimoIdToken()` y `obtenerUltimoIdAlerta()`

**Impacto:**
- IDs duplicados: `IND-0001`, `IND-0001`, `IND-0001` en vez de `IND-0001`, `IND-0002`, `IND-0003`
- Colisiones de PK en base de datos
- Relaciones FK inconsistentes

### 2. URLs de Firma Incorrectas

**Ubicación:** `src/core/use-cases/inducciones/generarTokenFirma.ts:38`

**Código actual:**
```typescript
const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const urlFirma = `${baseUrl}/inducciones/firma/${token.hashFirma}`;
```

**Problema potencial:**
- Variable de entorno `NEXT_PUBLIC_APP_URL` puede no estar configurada en Vercel
- Si `token.hashFirma` es `null` o vacío por fallo en creación, la URL queda malformada

**Impacto:**
- URLs tipo: `https://sirius-sg-sst.vercel.app/inducciones/firma/undefined`
- Links inaccesibles para empleados
- Proceso de firma bloqueado

## 🔧 Soluciones Propuestas

### Fix 1: Corregir Sorting en Airtable

**Estrategia A: Sort por Nombre de Campo (Recomendado)**
```typescript
private async obtenerUltimoIdInduccion(): Promise<string | null> {
  const url = `${this.client.baseUrl}/${this.registrosTableId}`;
  const params = new URLSearchParams({
    // 👇 Usar nombre del campo, no field ID
    sort: JSON.stringify([{field: 'ID_Induccion', direction: 'desc'}]),
    maxRecords: "1",
  });
  
  const response = await fetch(`${url}?${params}`, {
    headers: this.client.headers,
  });
  
  if (!response.ok) {
    console.error('[obtenerUltimoIdInduccion] Error:', await response.text());
    return null;
  }
  
  const data = await response.json();
  
  // 👇 Validar que haya registros y campo exista
  if (data.records.length === 0) {
    console.log('[obtenerUltimoIdInduccion] No hay registros, iniciando en IND-0001');
    return null;
  }
  
  const lastId = data.records[0].fields['ID_Induccion'] || null;
  console.log(`[obtenerUltimoIdInduccion] Último ID encontrado: ${lastId}`);
  
  return lastId;
}
```

**Estrategia B: Obtener Todos y Ordenar en JS (Si sort falla)**
```typescript
private async obtenerUltimoIdInduccion(): Promise<string | null> {
  const url = `${this.client.baseUrl}/${this.registrosTableId}`;
  const params = new URLSearchParams({
    fields: JSON.stringify(['ID_Induccion']), // Solo traer el campo que necesitamos
    pageSize: "100", // Traer últimos 100
  });
  
  const response = await fetch(`${url}?${params}`, {
    headers: this.client.headers,
  });
  
  if (!response.ok) {
    console.error('[obtenerUltimoIdInduccion] Error:', await response.text());
    return null;
  }
  
  const data = await response.json();
  
  if (data.records.length === 0) {
    return null;
  }
  
  // Ordenar en JS por número extraído
  const ids = data.records
    .map((r: any) => r.fields['ID_Induccion'])
    .filter(Boolean)
    .map((id: string) => ({
      original: id,
      numero: parseInt(id.split('-')[1] || '0', 10)
    }))
    .sort((a, b) => b.numero - a.numero); // DESC
  
  return ids.length > 0 ? ids[0].original : null;
}
```

### Fix 2: Validar Variables de Entorno y HashFirma

**En `generarTokenFirma.ts`:**
```typescript
export async function generarTokenFirma(
  idInduccion: string,
  idEmpleadoCore: string
): Promise<TokenFirma> {
  // ... código existente ...
  
  // Generar el token
  const token = await induccionesRepository.crearTokenFirma(idInduccion, idEmpleadoCore);
  
  // 👇 VALIDAR que hashFirma exista
  if (!token.hashFirma) {
    throw new Error('Error generando hash de firma - token inválido');
  }
  
  // 👇 VALIDAR variable de entorno
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    console.error('[generarTokenFirma] ERROR: NEXT_PUBLIC_APP_URL no está definida');
    throw new Error('Configuración de URL base faltante');
  }
  
  // 👇 Construir URL y validar
  const urlFirma = `${baseUrl}/inducciones/firma/${token.hashFirma}`;
  console.log(`[generarTokenFirma] URL generada: ${urlFirma}`);
  
  return {
    ...token,
    urlFirma,
  } as any;
}
```

### Fix 3: Validar en Vercel que ENV esté configurada

**Variables requeridas en Vercel:**
```bash
# En Project Settings > Environment Variables
NEXT_PUBLIC_APP_URL=https://sirius-sg-sst.vercel.app
```

**⚠️ IMPORTANTE:** Las variables `NEXT_PUBLIC_*` deben estar en **build time** y **runtime**.

## 📋 Plan de Implementación

### Fase 1: Diagnóstico en Producción
1. ✅ Revisar logs de Vercel para errores de sorting
2. ✅ Verificar que `NEXT_PUBLIC_APP_URL` esté configurada
3. ✅ Consultar tabla `ind_registros` en Airtable para ver IDs duplicados

### Fase 2: Aplicar Fix (Sorting)
1. Implementar **Estrategia A** (sort por nombre de campo)
2. Si falla, implementar **Estrategia B** (ordenar en JS)
3. Aplicar mismo fix a `obtenerUltimoIdToken()` y `obtenerUltimoIdAlerta()`
4. Agregar logging detallado

### Fase 3: Aplicar Fix (URLs)
1. Validar `NEXT_PUBLIC_APP_URL` en Vercel
2. Agregar validación de `hashFirma` no nulo
3. Agregar logging de URL generada

### Fase 4: Testing
1. Crear nueva inducción en dev
2. Verificar ID incremental: `IND-000X`
3. Generar link de firma
4. Verificar URL correcta: `https://sirius-sg-sst.vercel.app/inducciones/firma/[hash]`
5. Probar firma desde link público

### Fase 5: Deploy y Monitoreo
1. Deploy a producción
2. Monitorear logs por 24h
3. Crear 3 inducciones de prueba
4. Validar secuencia de IDs

## 🔍 Checklist de Verificación

### Pre-Deploy
- [ ] Variable `NEXT_PUBLIC_APP_URL` configurada en Vercel
- [ ] Logs agregados en métodos críticos
- [ ] Validaciones de null/undefined en hashFirma
- [ ] Sort por nombre de campo implementado
- [ ] Tests manuales en dev pasando

### Post-Deploy
- [ ] Verificar IDs autoincrementales en producción
- [ ] Probar generación de link de firma
- [ ] Validar URLs accesibles
- [ ] Monitorear logs de Vercel por errores
- [ ] Documentar en CLAUDE.md estado actualizado

## 📊 Código Actual vs Propuesto

| Aspecto | Antes | Después |
|---------|-------|---------|
| Sort Airtable | `field: RF.ID_INDUCCION` (Field ID) | `field: 'ID_Induccion'` (nombre) |
| Validación hashFirma | ❌ No existe | ✅ Throw si null |
| Validación NEXT_PUBLIC_APP_URL | ⚠️ Fallback a localhost | ✅ Throw si undefined |
| Logging | ⚠️ Mínimo | ✅ Detallado |
| Manejo de errores | ⚠️ Silent fail | ✅ Throw explícito |

## 🎯 Resultado Esperado

**Comportamiento correcto:**
```
Usuario registra inducción #1 → IND-0001
Usuario registra inducción #2 → IND-0002
Usuario registra inducción #3 → IND-0003

Usuario genera link #1 → https://sirius-sg-sst.vercel.app/inducciones/firma/abc123...xyz
Usuario genera link #2 → https://sirius-sg-sst.vercel.app/inducciones/firma/def456...uvw
```

**Sin duplicados de IDs ni URLs malformadas.**

---

**Próximos pasos:** Implementar Fix 1 (Estrategia A) y Fix 2, luego testing en dev.
