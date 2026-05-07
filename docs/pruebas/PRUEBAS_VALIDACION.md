# Pruebas de Validación de Respuestas

## Objetivo

Verificar que el fix de validación de respuestas funciona correctamente en todos los tipos de preguntas.

## Setup de Prueba

### 1. Crear Preguntas de Prueba en Airtable

En la tabla **Banco de Preguntas**, crear las siguientes preguntas:

#### Pregunta 1: Selección Única con espacios extras
- **Código**: `TEST-SEL-001`
- **Texto**: `¿Cuál es el EPP básico para protección de manos?`
- **Tipo**: `Selección Única`
- **Opciones JSON**:
```json
["Guantes de seguridad", "Protección  auditiva", "Casco de seguridad"]
```
- **Respuesta Correcta**: `Guantes  de seguridad` (con espacios dobles)
- **Estado**: `Activo`

#### Pregunta 2: Verdadero/Falso con espacios
- **Código**: `TEST-VF-001`
- **Texto**: `¿Es obligatorio el uso de casco en áreas de riesgo?`
- **Tipo**: `Verdadero/Falso`
- **Respuesta Correcta**: ` Verdadero ` (con espacios al inicio y final)
- **Estado**: `Activo`

#### Pregunta 3: Selección Múltiple con tildes
- **Código**: `TEST-MULT-001`
- **Texto**: `¿Cuáles son elementos de protección respiratoria?`
- **Tipo**: `Selección Múltiple`
- **Opciones JSON**:
```json
["Máscara con filtro", "Respirador N95", "Guantes", "Protección auditiva"]
```
- **Respuesta Correcta**: `["Mascara con filtro","Respirador N95"]` (sin tildes)
- **Estado**: `Activo`

### 2. Crear Plantilla de Evaluación

En la tabla **Plantillas Evaluación**:

- **Código**: `TEST-VALIDACION`
- **Nombre**: `Prueba Validación Respuestas`
- **Puntaje Mínimo**: `60`
- **Intentos**: `3`
- **Estado**: `Activo`

Vincular las 3 preguntas creadas arriba (usando tabla **Preguntas por Plantilla**).

## Casos de Prueba

### Caso 1: Respuesta con espacios extras ✅

**Pregunta**: Selección Única - EPP para manos

**Acción**:
1. Iniciar evaluación desde `/evaluar/capacitacion?token=XXX`
2. Seleccionar: `Guantes de seguridad`

**Resultado Esperado**:
- ✅ Respuesta marcada como CORRECTA
- Puntaje obtenido para esta pregunta: 100%

**Validación**:
- En Airtable, tabla **Respuestas Evaluación**, campo `ES_CORRECTA` debe ser `true`

---

### Caso 2: Verdadero/Falso con espacios ✅

**Pregunta**: ¿Es obligatorio el uso de casco?

**Acción**:
1. Seleccionar: `Verdadero`

**Resultado Esperado**:
- ✅ Respuesta marcada como CORRECTA
- Comparación exitosa: `"Verdadero"` (sin espacios) vs `" Verdadero "` (con espacios)

---

### Caso 3: Selección Múltiple sin tildes ✅

**Pregunta**: Protección respiratoria

**Acción**:
1. Seleccionar: `Máscara con filtro` (con tilde)
2. Seleccionar: `Respirador N95`
3. Enviar

**Resultado Esperado**:
- ✅ Respuesta marcada como CORRECTA
- Normalización exitosa: `"Máscara"` → `"mascara"` (sin tilde)
- Comparación exitosa contra `"Mascara con filtro"` guardado en Airtable

---

### Caso 4: Selección Múltiple en orden diferente ✅

**Pregunta**: Misma de Caso 3

**Acción**:
1. Seleccionar: `Respirador N95` (primero)
2. Seleccionar: `Máscara con filtro` (segundo)
3. Enviar

**Resultado Esperado**:
- ✅ Respuesta marcada como CORRECTA
- Arrays se ordenan antes de comparar: `["Respirador N95", "Máscara con filtro"]` → `["mascara con filtro", "respirador n95"]`

---

## Verificación en Airtable

Después de completar las pruebas:

### Tabla: Evaluaciones Aplicadas
- Campo **ESTADO**: debe ser `Aprobada`
- Campo **PUNTAJE_OBT**: debe ser igual a **PUNTAJE_MAX**
- Campo **PORCENTAJE**: debe ser `100.0`

### Tabla: Respuestas Evaluación
Todas las respuestas deben tener:
- **ES_CORRECTA**: `true` (checkbox marcado)
- **PUNTAJE**: igual al puntaje asignado en la plantilla

## Regresión: Casos que deben seguir funcionando

### Respuestas exactas ✅
- Input: `"Verdadero"` → Correcta: `"Verdadero"` → ✅ CORRECTO

### Respuestas con mayúsculas/minúsculas ✅
- Input: `"verdadero"` → Correcta: `"Verdadero"` → ✅ CORRECTO

### Selección Múltiple ordenada ✅
- Input: `["A", "B", "C"]` → Correcta: `["A", "B", "C"]` → ✅ CORRECTO

## Comando para Testing

```bash
npm run dev
```

Luego acceder a:
```
http://localhost:3000/evaluar/capacitacion?token=<GENERAR_TOKEN>
```

## Logs de Debugging

Para ver la comparación en consola del navegador:

1. Abrir DevTools (F12)
2. Ir a pestaña Console
3. Filtrar por: `evaluarCorrecta`

El componente `EvaluacionFlow.tsx` imprime internamente el resultado de cada validación.

## Rollback en caso de problemas

Si el fix causa problemas:

```bash
git checkout HEAD~1 -- src/components/evaluaciones/EvaluacionFlow.tsx
```

Luego:

```bash
npm run dev
```

## Notas Importantes

1. **No afecta evaluaciones pasadas**: Las evaluaciones ya guardadas en Airtable no cambian.
2. **Sin migración**: No se requiere actualizar datos existentes.
3. **Retrocompatible**: Respuestas que ya funcionaban seguirán funcionando.

## Siguiente Paso

Una vez validadas las pruebas, monitorear las evaluaciones en producción durante 1 semana para confirmar que:
- No hay falsos positivos (respuestas incorrectas marcadas como correctas)
- No hay regresión (respuestas que antes funcionaban ahora fallan)
