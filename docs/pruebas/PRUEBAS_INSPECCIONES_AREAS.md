# 🧪 Guía de Pruebas - Inspecciones de Áreas

## 📋 Resumen de Cambios Implementados

### ✅ 1. Infraestructura de Base de Datos
- ✅ **4 tablas creadas** en Airtable (Base SG-SST)
- ✅ **43 variables de entorno** agregadas a `.env.local`
- ✅ **Normalización 4NF** cumplida
- ✅ **Relaciones configuradas** automáticamente

### ✅ 2. Modificaciones al Formulario
- ✅ **Dropdown dinámico** para "Responsable Área" carga TODOS los empleados
- ✅ **Auto-fill automático** de cédula y cargo al seleccionar empleado
- ✅ **Campos editables** para permitir ajustes manuales
- ✅ **Dropdowns separados**: SST para Responsable/COPASST, Personal completo para Responsable Área

### ✅ 3. Script de Pruebas Automatizado
- ✅ **5 tests integrados** para validar funcionalidad completa
- ✅ **Reportes en consola** con colores y resumen
- ✅ **Datos de prueba** generados automáticamente
- ✅ **Ejecución rápida** con un solo comando

---

## 🚀 Cómo Ejecutar las Pruebas

### Prerequisitos
1. ✅ Servidor Next.js en ejecución (`npm run dev`)
2. ✅ Variables de entorno configuradas en `.env.local`
3. ✅ Conexión a internet (para Airtable)

### Ejecutar Script de Pruebas

```bash
# Opción 1: Usando npm
npm run test:inspecciones-areas

# Opción 2: Directo con Node
node test-inspecciones-areas.js
```

---

## 📊 Tests Incluidos

### Test 1: Cargar Responsables SST
**Qué valida:**
- ✅ Endpoint `/api/inspecciones-areas?responsables=true` funciona
- ✅ Retorna miembros activos del COPASST
- ✅ Estructura de datos correcta

**Resultado esperado:**
```
✓ Se cargaron N responsables SST
  Primer responsable: [nombre]
```

---

### Test 2: Cargar Personal Completo
**Qué valida:**
- ✅ Endpoint `/api/personal` funciona
- ✅ Retorna todos los empleados activos
- ✅ Campos requeridos presentes (nombreCompleto, numeroDocumento, tipoPersonal)

**Resultado esperado:**
```
✓ Se cargaron N empleados
  Primer empleado: [nombre] - [cargo]
```

---

### Test 3: Crear Inspección de Prueba
**Qué valida:**
- ✅ Endpoint POST `/api/inspecciones-areas` funciona
- ✅ Se crean correctamente las 4 tablas relacionadas:
  - Inspección cabecera
  - Detalles (criterios)
  - Acciones correctivas
  - Responsables (firmas)
- ✅ Datos se guardan en Airtable

**Resultado esperado:**
```
✓ Inspección creada: INSPA-XXX-YYYYMMDD-RRRR
  Fecha: YYYY-MM-DD
  Área: [área]
  Criterios guardados: 3
```

---

### Test 4: Listar Inspecciones
**Qué valida:**
- ✅ Endpoint GET `/api/inspecciones-areas` funciona
- ✅ Retorna inspecciones guardadas
- ✅ Incluye información de relaciones (criterios, acciones)

**Resultado esperado:**
```
✓ Se encontraron N inspecciones
  Última inspección: INSPA-XXX-YYYYMMDD-RRRR - [área] ([fecha])
  Estado: Completado
  Criterios: 3, Acciones: 1
```

---

### Test 5: Validar Variables de Entorno
**Qué valida:**
- ✅ Todas las variables de entorno están configuradas
- ✅ Table IDs presentes

**Resultado esperado:**
```
✓ AIRTABLE_INSPA_TABLE_ID configurada
✓ AIRTABLE_DETINSPA_TABLE_ID configurada
✓ AIRTABLE_RESPINSPA_TABLE_ID configurada
✓ AIRTABLE_ACCINSPA_TABLE_ID configurada
✓ Todas las variables de entorno están configuradas
```

---

## 🔍 Pruebas Manuales en el Navegador

### 1. Acceder al Formulario
```
http://localhost:3000/dashboard/inspecciones-areas
```

### 2. Verificar Dropdown "Responsable Inspección"
**Qué verificar:**
- [ ] El dropdown carga nombres automáticamente
- [ ] Aparecen miembros del COPASST (4-5 nombres)
- [ ] Incluye al Responsable SG-SST
- [ ] Total: ~5 responsables

### 3. Verificar Selector de Área
**Áreas disponibles:**
- [ ] Laboratorio
- [ ] Pirólisis
- [ ] Bodega
- [ ] Administrativa
- [ ] Guaicaramo

### 4. Verificar Criterios Dinámicos
**Qué hacer:**
1. Seleccionar un área
2. Verificar que se carguen criterios automáticamente

**Cantidad esperada:**
- Laboratorio: ~27 criterios
- Pirólisis: ~42 criterios
- Bodega: ~19 criterios
- Administrativa: ~15 criterios
- Guaicaramo: ~15 criterios

### 5. Verificar Evaluación de Criterios
**Qué hacer:**
1. Hacer clic en botones B/M/N/A de varios criterios
2. Escribir observaciones en algunos
3. Verificar que el contador "Criterios evaluados" se actualice

### 6. Verificar Acciones Correctivas
**Qué hacer:**
1. Hacer clic en "Agregar" acción
2. Llenar descripción, tipo, responsable, fecha
3. Agregar varias acciones
4. Eliminar alguna acción

### 7. **NUEVO**: Verificar Firmas con Dropdown de Personal
**Qué verificar:**

#### Firma "Responsable"
- [ ] Dropdown carga responsables SST (~5 nombres)
- [ ] Al seleccionar, auto-completa cédula y cargo
- [ ] Cédula y cargo son **editables manualmente**

#### Firma "COPASST"
- [ ] Dropdown carga miembros COPASST (~4 nombres)
- [ ] Al seleccionar, auto-completa cédula y cargo
- [ ] Cédula y cargo son **editables manualmente**

#### Firma "Responsable Área" ⭐ **NUEVO**
- [ ] Dropdown carga **TODOS los empleados** (debería ser lista larga)
- [ ] Al seleccionar, auto-completa cédula y cargo
- [ ] Cédula y cargo son **editables manualmente**
- [ ] Los nombres corresponden a empleados reales de Personal

### 8. Verificar Canvas de Firma
**Qué hacer:**
1. Seleccionar un responsable en cada firma
2. Hacer clic en "Firmar"
3. Dibujar en el canvas
4. Verificar botones: Limpiar, Cancelar, Confirmar
5. Confirmar firma
6. Verificar que aparezca "Firmado" con ✓

### 9. Guardar Inspección
**Qué hacer:**
1. Completar todos los campos requeridos:
   - Fecha
   - Responsable inspección
   - Área
   - Al menos 1 criterio evaluado
   - Al menos 1 firma
2. Hacer clic en "Guardar"
3. Verificar mensaje de éxito
4. Verificar que el ID de inspección se muestre

### 10. Verificar en Airtable
**Qué verificar:**

1. **Tabla "Inspecciones Áreas"**
   - [ ] Registro nuevo con ID único
   - [ ] Fecha correcta
   - [ ] Área correcta
   - [ ] Estado = "Completado"

2. **Tabla "Detalle Inspección Áreas"**
   - [ ] Registros de criterios evaluados
   - [ ] Categorías y criterios correctos
   - [ ] Condiciones (Bueno/Malo/NA)
   - [ ] Link a inspección padre

3. **Tabla "Responsables Inspección Áreas"**
   - [ ] 3 registros de firmas
   - [ ] Tipos correctos
   - [ ] Firmas encriptadas (texto largo)
   - [ ] Link a inspección padre

4. **Tabla "Acciones Correctivas Áreas"**
   - [ ] Registros de acciones
   - [ ] Estado = "Pendiente"
   - [ ] Link a inspección padre

---

## 🐛 Problemas Comunes y Soluciones

### Problema 1: Dropdown "Responsable Inspección" vacío
**Síntomas:**
- El dropdown muestra "Cargando..." indefinidamente
- O muestra "Seleccionar responsable..." pero sin opciones

**Soluciones:**
1. Verificar que existan miembros activos del COPASST en Airtable
2. Verificar que el Responsable SG-SST tenga el cargo correcto
3. Revisar consola del navegador para errores
4. Verificar variables de entorno `AIRTABLE_MBR_*`

---

### Problema 2: Dropdown "Responsable Área" vacío
**Síntomas:**
- El dropdown de "Responsable Área" no carga empleados
- O carga pero sin nombres

**Soluciones:**
1. Verificar que `/api/personal` funcione: `curl http://localhost:3000/api/personal`
2. Verificar que existan empleados activos en la tabla Personal
3. Verificar variables de entorno `AIRTABLE_PF_*`
4. Revisar consola del navegador para errores

---

### Problema 3: Error al guardar inspección
**Síntomas:**
- Mensaje de error al hacer clic en "Guardar"
- Error 500 o 400

**Soluciones:**
1. Verificar que todas las 43 variables de entorno estén configuradas
2. Reiniciar servidor Next.js (`Ctrl+C` y `npm run dev`)
3. Verificar que las 4 tablas existan en Airtable
4. Revisar logs del servidor en la terminal
5. Ejecutar el script de pruebas: `npm run test:inspecciones-areas`

---

### Problema 4: Firmas no se encriptan
**Síntomas:**
- Las firmas aparecen como data URLs sin encriptar en Airtable

**Solución:**
1. Verificar que `AES_SIGNATURE_SECRET` esté en `.env.local`
2. Reiniciar servidor

---

### Problema 5: No aparecen criterios al seleccionar área
**Síntomas:**
- Al seleccionar un área, no se cargan criterios

**Solución:**
1. Verificar código del frontend
2. Verificar que `getCriteriosForArea()` funcione
3. Revisar consola del navegador

---

## 📈 Métricas de Éxito

Para considerar que el módulo está funcionando correctamente:

✅ **Tests Automatizados**: 5/5 tests pasando (100%)
✅ **Dropdown Responsables SST**: Carga 4-5 nombres
✅ **Dropdown Personal**: Carga lista completa de empleados
✅ **Auto-fill**: Cédula y cargo se llenan automáticamente
✅ **Edición Manual**: Campos de cédula y cargo editables
✅ **Criterios**: Se cargan dinámicamente por área
✅ **Guardado**: Inspección se guarda en las 4 tablas
✅ **Encriptación**: Firmas se guardan encriptadas

---

## 📞 Soporte

Si encuentras problemas:

1. **Ejecutar diagnóstico automático**:
   ```bash
   npm run test:inspecciones-areas
   ```

2. **Revisar logs del servidor**:
   - Abrir terminal donde corre `npm run dev`
   - Buscar errores en rojo

3. **Revisar consola del navegador**:
   - F12 → Consola
   - Buscar errores en rojo

4. **Verificar Airtable**:
   - Abrir base "Sirius SG-SST"
   - Verificar que las 4 tablas existan
   - Verificar permisos de API

---

## ✅ Checklist Final

Antes de considerar el módulo completo:

- [ ] Servidor Next.js corriendo sin errores
- [ ] Variables de entorno configuradas (43 variables)
- [ ] 4 tablas creadas en Airtable
- [ ] Tests automatizados pasando (5/5)
- [ ] Dropdown responsables SST funcional
- [ ] **NUEVO**: Dropdown personal completo funcional
- [ ] **NUEVO**: Auto-fill de cédula y cargo funcional
- [ ] **NUEVO**: Edición manual de campos funcional
- [ ] Criterios se cargan por área
- [ ] Evaluación de criterios funcional
- [ ] Acciones correctivas funcionan (agregar/eliminar)
- [ ] Canvas de firma funcional
- [ ] Guardado exitoso de inspecciones
- [ ] Datos aparecen correctamente en Airtable
- [ ] Firmas se encriptan correctamente

---

**Última actualización**: 2026-03-20
**Script de pruebas**: `test-inspecciones-areas.js`
**Comando de prueba**: `npm run test:inspecciones-areas`
