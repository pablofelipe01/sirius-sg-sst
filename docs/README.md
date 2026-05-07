# Documentación — Sirius SG-SST

Índice de toda la documentación técnica del proyecto, organizada por categoría.

---

## 📁 Estructura

```
docs/
├── analisis/        Análisis técnicos de módulos y requerimientos
├── estado/          Estado del proyecto y changelogs
├── fixes/           Diagnósticos y correcciones de bugs
├── guias/           Guías paso a paso para configuración manual
├── implementacion/  Guías de implementación de nuevas funcionalidades
├── pruebas/         Planes y datos de prueba
└── seguridad/       Auditorías y controles de seguridad
```

---

## 🔍 Análisis

| Archivo | Descripción |
|---------|-------------|
| [ANALISIS_ASISTENCIA_COMITES.md](analisis/ANALISIS_ASISTENCIA_COMITES.md) | Análisis del sistema de asistencia a comités con firmas digitales individuales (COPASST/COCOLAB) |
| [ANALISIS_INSPECCIONES_AREAS.md](analisis/ANALISIS_INSPECCIONES_AREAS.md) | Tablas faltantes y requisitos estructurales para inspecciones de áreas físicas |
| [ANALISIS_REGISTRO_ASISTENCIA_Y_ENTREVISTA_CAPACITACIONES.md](analisis/ANALISIS_REGISTRO_ASISTENCIA_Y_ENTREVISTA_CAPACITACIONES.md) | Análisis del módulo de asistencia a capacitaciones y entrevista de requerimientos |

---

## 📊 Estado del Proyecto

| Archivo | Descripción |
|---------|-------------|
| [ESTADO_PROYECTO_2026-03-24.md](estado/ESTADO_PROYECTO_2026-03-24.md) | Snapshot completo del proyecto al 24-Mar-2026 (75% completitud, stack, módulos, deuda técnica) |
| [CHANGELOG_DOCUMENTACION.md](estado/CHANGELOG_DOCUMENTACION.md) | Resumen de actualizaciones a `CLAUDE.md` y `README.md` |
| [RESUMEN_ACTUALIZACION_DOCS.md](estado/RESUMEN_ACTUALIZACION_DOCS.md) | Resumen ejecutivo de la expansión de documentación (+738% README) |

---

## 🐛 Fixes y Diagnósticos

| Archivo | Módulo | Fecha |
|---------|--------|-------|
| [FIX_S3_CORS_ENTREGA_EPP.md](fixes/FIX_S3_CORS_ENTREGA_EPP.md) | Entrega EPP — fotos de evidencia | 2026-05-07 |
| [DIAGNOSTICO_INSPECCIONES_AREAS.md](fixes/DIAGNOSTICO_INSPECCIONES_AREAS.md) | Inspecciones Áreas — reportes vacíos por FIND() incorrecto | 2026-03 |
| [DIAGNOSTICO_EVALUACIONES.md](fixes/DIAGNOSTICO_EVALUACIONES.md) | Evaluaciones — meses mezclados, validación y respuestas invertidas | 2026-03 |
| [FIX_VALIDACION_RESPUESTAS.md](fixes/FIX_VALIDACION_RESPUESTAS.md) | Evaluaciones — normalización de tildes y espacios | 2026-03 |
| [RESUMEN_FIX_EVALUACIONES.md](fixes/RESUMEN_FIX_EVALUACIONES.md) | Evaluaciones — resumen ejecutivo de todas las correcciones | 2026-03 |
| [FIX_INSPECCIONES_EQUIPOS_EMERGENCIA.md](fixes/FIX_INSPECCIONES_EQUIPOS_EMERGENCIA.md) | Inspecciones Equipos — exportación PDF para 4 tipos de inspección | 2026-03 |

---

## 🛠 Implementación

| Archivo | Descripción |
|---------|-------------|
| [IMPLEMENTACION_INSPECCIONES_AREAS.md](implementacion/IMPLEMENTACION_INSPECCIONES_AREAS.md) | Guía completa: tablas Airtable, variables de entorno y flujo de inspecciones de áreas |
| [IMPLEMENTACION_FIRMA_ASISTENTES.md](implementacion/IMPLEMENTACION_FIRMA_ASISTENTES.md) | Captura de firmas individuales en actas de comités (dos flujos de firma) |

---

## 🧪 Pruebas

| Archivo | Descripción |
|---------|-------------|
| [PRUEBAS_INSPECCIONES_AREAS.md](pruebas/PRUEBAS_INSPECCIONES_AREAS.md) | Plan de pruebas y script automatizado para 5 aspectos del módulo de inspecciones |
| [PRUEBAS_VALIDACION.md](pruebas/PRUEBAS_VALIDACION.md) | Datos de prueba para validación de respuestas con tildes, espacios y casos extremos |

---

## 📋 Guías

| Archivo | Descripción |
|---------|-------------|
| [GUIA_CREAR_TABLA_ASISTENCIA_COMITES.md](guias/GUIA_CREAR_TABLA_ASISTENCIA_COMITES.md) | Paso a paso para crear la tabla `asistencia_comites` en Airtable con 9 campos |

---

## 🔒 Seguridad

| Archivo | Descripción |
|---------|-------------|
| [AUDITORIA_SEGURIDAD.md](seguridad/AUDITORIA_SEGURIDAD.md) | Auditoría OWASP Top 10, controles criptográficos y estado de cumplimiento |
