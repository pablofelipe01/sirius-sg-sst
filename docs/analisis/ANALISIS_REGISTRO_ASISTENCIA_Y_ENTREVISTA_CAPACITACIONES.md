# Análisis: Módulo de Registro de Asistencia (Capacitaciones)
# + Prompt de Entrevista para Nueva Funcionalidad

> **Propósito de este documento**: Documentar cómo está implementado el módulo
> de registro de asistencia en Sirius SG-SST, e incluir un prompt de entrevista
> para levantar requisitos de la nueva funcionalidad dentro del módulo de capacitaciones.

---

## PARTE 1: ANÁLISIS TÉCNICO DE LA IMPLEMENTACIÓN ACTUAL

### 1.1 Arquitectura General del Módulo

El módulo de registros de asistencia es una arquitectura distribuida que cubre
el ciclo completo desde la creación del evento hasta la exportación de informes.

**Archivos principales:**

| Archivo | Rol |
|---------|-----|
| `src/app/api/registros-asistencia/route.ts` | CRUD principal del evento + asistentes |
| `src/app/api/registros-asistencia/token/route.ts` | Generación de tokens HMAC-SHA256 por asistente |
| `src/app/api/registros-asistencia/firmar-publico/route.ts` | Firma remota pública (GET data + POST guardar) |
| `src/app/api/registros-asistencia/firmar/route.ts` | Firma directa desde dashboard (no token) |
| `src/app/api/registros-asistencia/exportar/route.ts` | Exportar lista de asistencia a Excel (.xlsx) |
| `src/app/api/registros-asistencia/evaluaciones-pdf/route.ts` | Exportar evaluaciones en PDF |
| `src/app/api/capacitaciones/route.ts` | Catálogo de capacitaciones (GET) |
| `src/app/dashboard/registros-asistencia/page.tsx` | Lista de eventos (historial) |
| `src/app/dashboard/registros-asistencia/nuevo/page.tsx` | Crear nuevo registro |
| `src/app/dashboard/registros-asistencia/historial/page.tsx` | Historial detallado |
| `src/app/firmar/capacitacion/page.tsx` | Página pública de firma (Canvas HTML5) |
| `src/lib/signingToken.ts` | Biblioteca HMAC-SHA256 (stateless tokens) |

---

### 1.2 Flujo Completo del Módulo (6 Fases)

```
┌─────────────────────────────────────────────────────────────────┐
│  FASE 1: CREACIÓN DEL EVENTO Y REGISTRO DE ASISTENTES           │
│  POST /api/registros-asistencia                                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
         1. Validar entradas (capacitacionCodigo, asistentes)
         2. Resolver poblaciones objetivo por comité SST
            ┌──────────────────────────────────────────┐
            │ POBLACIÓN = "Responsable SG-SST"         │
            │ → Solo empleados en Miembros Comités SST │
            │                                          │
            │ POBLACIÓN = "COPASST"                    │
            │ → Solo miembros COPASST activos           │
            │                                          │
            │ POBLACIÓN = "Todos los Colaboradores"    │
            │ → Sin filtro por comité                  │
            └──────────────────────────────────────────┘
         3. Generar código único: EVT-CAP{código}-{año}-{timestamp}
         4. Crear Evento Capacitación (estado: "En Curso")
         5. Crear registros Asistencia Capacitaciones (batch x10)
            - ID_ASISTENCIA: "ASIS-EVT-CAP1.1-2026-47629-001"
            - FIRMA_CONFIRMADA: false
            - PROGRAMACION_LINK: programaciones filtradas por comité
         6. Actualizar Programación (EJECUTADO: true, TOTAL_ASISTENTES: N)

┌─────────────────────────────────────────────────────────────────┐
│  FASE 2: GENERACIÓN DE TOKENS DE FIRMA                          │
│  POST /api/registros-asistencia/token                           │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
         Por cada asistente:
         → generateSigningToken({ r, e, n, c }, 72h)
         → URL: /firmar/capacitacion?t={token}
         → El token es stateless: no requiere BD para validar

┌─────────────────────────────────────────────────────────────────┐
│  FASE 3: FIRMA REMOTA (PÚBLICA)                                 │
│  GET/POST /api/registros-asistencia/firmar-publico              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
         GET ?t=TOKEN:
           1. verifySigningToken(token) → payload
           2. Fetch Evento + Asistencia desde Airtable
           3. Verificar si ya firmó (FIRMA_CONFIRMADA)
           4. Retornar datos para mostrar en UI pública

         POST (guardar firma):
           1. Validar token (HMAC-SHA256)
           2. Verificar no duplicado (409 si ya firmó)
           3. Encriptar firma PNG con AES-256-CBC
              → {signature, employee, document, nombre, timestamp}
              → cifrado con IV aleatorio: "${iv}:${ciphertext}"
           4. PATCH Asistencia (FIRMA, FIRMA_CONFIRMADA: true)
           5. Retornar idEmpleadoCore → inicia EvaluacionFlow

┌─────────────────────────────────────────────────────────────────┐
│  FASE 4: EVALUACIÓN POST-FIRMA                                  │
│  Componente: src/components/evaluaciones/EvaluacionFlow.tsx     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
         Si idEmpleadoCore existe:
           → Verificar plantilla de evaluación linked a programación
           → Mostrar preguntas del banco
           → Registrar Evaluación Aplicada + Respuestas
           → Calcular puntaje y estado (Aprobada/Reprobada)

┌─────────────────────────────────────────────────────────────────┐
│  FASE 5: EXPORTACIÓN A EXCEL                                    │
│  POST /api/registros-asistencia/exportar                        │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
         Genera formato FT-SST-021 (lista de asistencia oficial):
           - Logo empresa + encabezados corporativos
           - Datos del evento (fecha, lugar, conferencista)
           - Tabla: ITEM | NOMBRES | CÉDULA | LABOR | FIRMA
           - Firmas descifradas AES → procesadas a PNG negro/transparente
           - Inserción de imágenes de firma en celdas
           - Firma del conferencista al final
           - A4 Portrait, 1 página de ancho

┌─────────────────────────────────────────────────────────────────┐
│  FASE 6: EXPORTACIÓN DE EVALUACIONES A PDF                      │
│  POST /api/registros-asistencia/evaluaciones-pdf                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
         Genera informe de resultados:
           - Mejor intento por empleado + plantilla
           - Estadísticas: evaluados, aprobados, promedio
           - Tabla coloreada (verde/rojo según estado)
           - Firmas descifradas de cada asistente
           - Letter Landscape, jsPDF + AutoTable
```

---

### 1.3 Tablas Airtable Involucradas

```
CAPACITACIONES (catálogo)
    ↕ link (1-many)
PROGRAMACIÓN CAPACITACIONES (plan mensual)
    ↕ link (1-many)
EVENTOS CAPACITACIÓN (cabecera del registro)
    ↕ link (1-many)
ASISTENCIA CAPACITACIONES (detalle por asistente)
    ↕ link (M-M filtrado por comité)
MIEMBROS COMITÉS SST (control de acceso poblacional)

PLANTILLAS EVALUACIÓN
    ↕ link (M-M)
EVALUACIONES APLICADAS
    ↕ link (1-many)
RESPUESTAS EVALUACIÓN

Personal (base separada — FK simbólica vía NUMERO_DOCUMENTO)
```

**Campos clave de ASISTENCIA CAPACITACIONES:**

| Campo | Tipo | Descripción |
|-------|------|-------------|
| `ID_ASISTENCIA` | string | Código único: `ASIS-{eventoCode}-{idx}` |
| `NOMBRES`, `CEDULA`, `LABOR` | string | Datos del asistente |
| `EVENTO_LINK` | link | → Evento Capacitación |
| `PROGRAMACION_LINK` | link[] | → Programaciones (filtradas por comité) |
| `ID_EMPLEADO_CORE` | string | FK simbólica al sistema de personal |
| `FIRMA` | string | AES-256-CBC encrypted JSON (PNG en base64) |
| `FIRMA_CONFIRMADA` | boolean | true cuando el asistente firma |
| `FECHA_REGISTRO` | date | Fecha del evento |

---

### 1.4 Patrones Técnicos Clave (Reutilizables)

#### Patrón A — Token Stateless HMAC-SHA256

```typescript
// src/lib/signingToken.ts
// Generar token (payload + expiry, sin BD)
const token = generateSigningToken({ r, e, n, c }, 72); // 72 horas

// Validar token (devuelve payload o null)
const payload = verifySigningToken(token);

// URL pública autosuficiente
`/firmar/capacitacion?t=${token}`
```

#### Patrón B — Encriptación AES-256-CBC en reposo

```typescript
// El campo FIRMA en Airtable guarda: "${iv_base64}:${ciphertext_base64}"
// Contiene: { signature (PNG), employee, document, nombre, timestamp, source }
// Se descifra en tiempo real durante exportaciones
```

#### Patrón C — Filtrado por Población/Comité

```typescript
// Al crear asistencia, la PROGRAMACION_LINK de cada asistente
// se filtra según la POBLACION de la capacitación:
// "Responsable SG-SST" → solo miembros con ese comité
// "COPASST" → solo miembros COPASST activos
// "Todos" → sin filtro
```

#### Patrón D — Batching Airtable (evitar límite de fórmula)

```typescript
// Para cargar muchos registros por ID:
// OR(RECORD_ID()='rec1', RECORD_ID()='rec2', ...) en batches de 10-50
const batches = chunk(recordIds, 10);
for (const batch of batches) {
  const formula = `OR(${batch.map(id => `RECORD_ID()='${id}'`).join(",")})`;
  const records = await table.select({ filterByFormula: formula }).all();
}
```

#### Patrón E — Actualización reactiva de Programación

```typescript
// Al crear el registro, la programación se actualiza automáticamente:
await progTable.update(progId, {
  [PF.EJECUTADO]: true,
  [PF.FECHA_EJECUCION]: eventoData.fecha,
  [PF.TOTAL_ASISTENTES]: asistentesCount
});
```

---

### 1.5 Variables de Entorno del Módulo

```bash
# Airtable SG-SST
AIRTABLE_SGSST_API_TOKEN
AIRTABLE_SGSST_BASE_ID

# Table IDs
AIRTABLE_CAP_TABLE_ID        # Capacitaciones
AIRTABLE_PROG_TABLE_ID       # Programación Capacitaciones
AIRTABLE_EVT_TABLE_ID        # Eventos Capacitación
AIRTABLE_ASIS_TABLE_ID       # Asistencia Capacitaciones
AIRTABLE_COMITE_TABLE_ID     # Miembros Comités SST

# Field IDs — Evento Capacitación (AIRTABLE_EVT_*)
AIRTABLE_EVT_CODIGO, EVT_CIUDAD, EVT_LUGAR, EVT_FECHA
AIRTABLE_EVT_HORA_INICIO, EVT_DURACION, EVT_AREA, EVT_TIPO
AIRTABLE_EVT_TEMAS_TRATADOS, EVT_NOMBRE_CONFERENCISTA, EVT_ESTADO
AIRTABLE_EVT_ASISTENCIA_LINK, EVT_PROGRAMACION_LINK
AIRTABLE_EVT_FIRMA_CONFERENCISTA

# Field IDs — Asistencia (AIRTABLE_ASIS_*)
AIRTABLE_ASIS_ID_ASISTENCIA, ASIS_NOMBRES, ASIS_CEDULA, ASIS_LABOR
AIRTABLE_ASIS_FIRMA_CONFIRMADA, ASIS_FECHA_REGISTRO
AIRTABLE_ASIS_EVENTO_LINK, ASIS_PROGRAMACION_LINK
AIRTABLE_ASIS_ID_EMPLEADO_CORE, ASIS_FIRMA

# Field IDs — Programación (AIRTABLE_PROG_*)
AIRTABLE_PROG_IDENTIFICADOR, PROG_MES, PROG_EJECUTADO
AIRTABLE_PROG_FECHA_EJECUCION, PROG_TOTAL_ASISTENTES
AIRTABLE_PROG_CAPACITACION_LINK, PROG_EVENTOS_LINK

# Field IDs — Comités
AIRTABLE_COMITE_ID_EMPLEADO, COMITE_COMITE, COMITE_ESTADO
AIRTABLE_COMITE_EXCLUIR_ASISTENCIA

# Seguridad
AES_SIGNATURE_SECRET          # Clave para HMAC-SHA256 y AES-256-CBC
```

---

## PARTE 2: PROMPT DE ENTREVISTA — NUEVA FUNCIONALIDAD EN EL MÓDULO DE CAPACITACIONES

> **Instrucciones para el agente que use este prompt**: Realiza las preguntas
> de la entrevista de manera conversacional. Presenta una sección a la vez,
> espera las respuestas del usuario, y al final genera un documento de requisitos
> estructurado. Las preguntas entre corchetes `[...]` son ejemplos de opciones para orientar.

---

## PROMPT DE ENTREVISTA

```
Eres un analista de sistemas especializado en sistemas de gestión SST (Seguridad y 
Salud en el Trabajo). Vas a entrevistar al usuario para levantar los requisitos de 
una nueva funcionalidad que quiere implementar dentro del módulo de capacitaciones 
del sistema Sirius SG-SST.

El sistema ya cuenta con:
- Registro de asistencia con firma digital remota (HMAC-SHA256)
- Evaluaciones post-capacitación
- Exportación a Excel y PDF
- Plan anual de capacitaciones
- Catálogo de temas de capacitación
- Control de poblaciones objetivo (Responsable SG-SST, COPASST, Todos)

Realiza la entrevista de forma conversacional, en español colombiano. 
Presenta una sección a la vez y espera respuesta antes de continuar.

─────────────────────────────────────────────────────────────
SECCIÓN 1 — CONTEXTO GENERAL
─────────────────────────────────────────────────────────────

Comenzar con:

"Para entender bien lo que necesitas implementar, vamos paso a paso.
Cuéntame con tus propias palabras: ¿qué es lo que quieres lograr con esta 
nueva funcionalidad en el módulo de capacitaciones?"

Preguntas de seguimiento si la respuesta es vaga:
- ¿Es algo que ya existe en el sistema y quieres mejorarlo, o es algo completamente nuevo?
- ¿Qué problema concreto estás tratando de resolver?
- ¿Hay algún proceso manual (en papel, Excel, WhatsApp) que quieras digitalizar?

─────────────────────────────────────────────────────────────
SECCIÓN 2 — ACTORES Y USUARIOS
─────────────────────────────────────────────────────────────

"Ahora hablemos de quién va a usar esto. Ayúdame a entender los actores involucrados:"

Preguntas:
1. ¿Quién crea o inicia el proceso? ¿El Responsable SG-SST, un coordinador, otro?
2. ¿Quién más participa? ¿Los empleados, un capacitador externo, jefes de área?
3. ¿Hay alguna aprobación o validación de otra persona involucrada?
4. ¿Los participantes van a interactuar desde un celular/link público, 
   o solo desde el dashboard administrativo?

─────────────────────────────────────────────────────────────
SECCIÓN 3 — DATOS Y CONTENIDO
─────────────────────────────────────────────────────────────

"Hablemos de qué información necesita manejar esta funcionalidad:"

Preguntas:
1. ¿Qué datos principales se van a registrar? 
   [Ej: fechas, asistentes, temas, materiales, evaluaciones, fotos, etc.]
2. ¿Existe algún formulario en papel o formato Word/Excel que ya se use?
   Si lo tienes, ¿me puedes describir los campos que tiene?
3. ¿Hay categorías o tipos diferentes de este proceso?
   [Ej: ¿hay capacitaciones presenciales vs virtuales con flujos distintos?]
4. ¿Qué documentos o archivos están involucrados?
   [Ej: presentaciones, videos, certificados, constancias, evaluaciones]
5. ¿Se necesita manejar vencimientos o vigencias?
   [Ej: una capacitación vence cada año y hay que renovarla]

─────────────────────────────────────────────────────────────
SECCIÓN 4 — FLUJO DEL PROCESO
─────────────────────────────────────────────────────────────

"Cuéntame cómo sería el paso a paso ideal de este proceso:"

Preguntas:
1. ¿Cómo empieza el proceso? ¿Alguien lo programa con anticipación o es reactivo?
2. ¿Qué pasa después de que se realiza la actividad?
   ¿Se registra asistencia, se evalúa, se genera un certificado, se notifica?
3. ¿El proceso termina con algún documento oficial o notificación?
4. ¿Qué pasa si alguien no asiste o no aprueba? ¿Hay reprogramación?
5. ¿Hay estados o etapas en el proceso?
   [Ej: Programado → En Curso → Finalizado → Certificado emitido]

─────────────────────────────────────────────────────────────
SECCIÓN 5 — INTEGRACIONES
─────────────────────────────────────────────────────────────

"Hablemos de cómo esto se conecta con lo que ya existe:"

Preguntas:
1. ¿Esta funcionalidad debe conectarse con el registro de asistencia existente?
   [¿O es algo paralelo, independiente?]
2. ¿Debe vincularse al plan anual de capacitaciones?
3. ¿Debe generar o modificar algún indicador o reporte del sistema?
4. ¿Se necesita exportar algo a Excel o PDF con un formato específico?
   [Si hay formato en papel, ¿podría describírmelo o enviarlo?]
5. ¿Se necesita enviar notificaciones? ¿Por correo, WhatsApp, link público?

─────────────────────────────────────────────────────────────
SECCIÓN 6 — INDICADORES Y REPORTES
─────────────────────────────────────────────────────────────

"¿Qué métricas o reportes se necesitan?"

Preguntas:
1. ¿Qué indicadores o estadísticas necesitas ver?
   [Ej: % cumplimiento, número de capacitados, horas de formación acumuladas]
2. ¿Hay un informe mensual, trimestral o anual que alimentaría esta información?
3. ¿Hay algún indicador de gestión SST (como el SGSST colombiano lo exige) 
   que esta funcionalidad deba satisfacer?
4. ¿La información debe ser visible en el dashboard principal o en un módulo aparte?

─────────────────────────────────────────────────────────────
SECCIÓN 7 — RESTRICCIONES Y PRIORIDADES
─────────────────────────────────────────────────────────────

"Por último, hablemos de lo que es urgente y lo que puede esperar:"

Preguntas:
1. ¿Cuál es la parte más importante o urgente de implementar primero?
2. ¿Hay una fecha límite o un evento próximo que necesite esta funcionalidad?
3. ¿Hay algo que definitivamente NO debe hacer o cambiar?
   [Ej: "no quiero tocar el módulo de evaluaciones actual"]
4. ¿Cuántos usuarios aproximadamente van a usar esto?
5. ¿Hay requerimientos legales o normativos específicos que debas cumplir?
   [Ej: Decreto 1072/2015, Resolución 0312, ISO 45001]

─────────────────────────────────────────────────────────────
CIERRE: GENERACIÓN DE DOCUMENTO DE REQUISITOS
─────────────────────────────────────────────────────────────

Una vez completadas todas las secciones, genera un documento estructurado con:

1. **RESUMEN EJECUTIVO** (2-3 párrafos en español colombiano)
   - Qué se va a implementar
   - Por qué es necesario
   - Impacto esperado

2. **ACTORES IDENTIFICADOS**
   - Tabla: Actor | Rol | Permisos esperados

3. **ESTRUCTURA DE DATOS PROPUESTA**
   - Tabla: Campo | Tipo | Descripción | Obligatorio
   - Relaciones con tablas existentes (Airtable SG-SST)

4. **FLUJO DEL PROCESO**
   - Diagrama textual paso a paso (como el de PARTE 1 de este documento)

5. **ENDPOINTS API NECESARIOS**
   - Tabla: Método | Ruta | Descripción

6. **PÁGINAS FRONTEND NECESARIAS**
   - Tabla: Ruta dashboard | Tipo (lista/formulario/detalle) | Descripción

7. **EXPORTACIONES NECESARIAS**
   - Formato (Excel/PDF) | Contenido | Template de referencia

8. **VARIABLES DE ENTORNO NUEVAS**
   - Lista de nuevas variables requeridas en .env

9. **ORDEN DE IMPLEMENTACIÓN SUGERIDO**
   - Lista priorizada de tareas técnicas

10. **CRITERIOS DE ACEPTACIÓN**
    - Lista de condiciones para considerar la funcionalidad completa
```

---

## CÓMO USAR ESTE DOCUMENTO

### Opción A — Entrevista interactiva con el agente
Pega el **PROMPT DE ENTREVISTA** en una nueva conversación con el agente de IA
y responde cada sección. Al final el agente generará el documento de requisitos.

### Opción B — Completar el documento directamente
Si ya tienes claridad sobre lo que quieres, responde directamente las
preguntas de las **Secciones 1 a 7** en este documento y pide al agente
que genere el documento de requisitos con base en tus respuestas.

### Opción C — Reutilizar los patrones técnicos
Si el nuevo módulo sigue el mismo patrón (registro → firma → evaluación → exportación),
puedes reutilizar directamente:
- `src/lib/signingToken.ts` — para tokens públicos
- `src/app/api/registros-asistencia/exportar/route.ts` — como base para exportar Excel
- `src/app/api/registros-asistencia/evaluaciones-pdf/route.ts` — como base para PDF
- Los patrones de batching de Airtable (Patrón D)

---

*Generado el 2026-05-06 · Basado en el análisis de src/app/api/registros-asistencia/*
