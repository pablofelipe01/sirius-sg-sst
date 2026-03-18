# Skill: Dominio SG-SST — Sirius Energy Group

Conocimiento del dominio de Seguridad y Salud en el Trabajo (SG-SST) de Sirius Energy Group (empresa colombiana de energía).

## Contexto Legal

El Sistema de Gestión de Seguridad y Salud en el Trabajo (SG-SST) es obligatorio en Colombia según:
- **Decreto 1072 de 2015** — Decreto Único Reglamentario del Sector Trabajo
- **Resolución 0312 de 2019** — Estándares Mínimos del SG-SST
- **Ley 1562 de 2012** — Sistema de Riesgos Laborales

## Módulos del Sistema

### 1. Capacitaciones SST
Registro y seguimiento de capacitaciones obligatorias:
- Trabajo en alturas
- Manejo de sustancias químicas
- Primeros auxilios
- Prevención de riesgo eléctrico
- Ergonomía y pausas activas
- Uso correcto de EPP

**Flujo**:
```
Programar capacitación → Ejecutar evento → Registrar asistencia → Evaluar → Generar certificados
```

### 2. Registros de Asistencia
Control de asistencia a capacitaciones y eventos SST:
- Evento vinculado a programación anual
- Asistentes vinculados a comités (COPASST, Brigada, Convivencia)
- Firma digital remota (token HMAC-SHA256 por WhatsApp)
- Exportación PDF/Excel

**Código de evento**: `EVT-CAP{codigoBase}-{año}-{timestamp}`

### 3. Evaluaciones Post-Capacitación
Evaluaciones de conocimiento después de cada capacitación:
- Plantillas de evaluación por tema
- Respuestas individuales con cálculo de puntaje
- Porcentaje de aprobación configurable
- PDF de resultados (individual y unificado)

### 4. Entregas de EPP (Equipos de Protección Personal)
Registro de entrega de EPP a empleados:
- Casco, guantes, botas, gafas, arnés, etc.
- Firma digital del empleado receptor
- Historial de entregas por persona
- Token de firma remota para confirmación

### 5. Inspecciones de EPP
Inspecciones periódicas del estado de los EPP entregados:
- Checklist por tipo de EPP
- Estado: Bueno / Regular / Malo / Para cambio
- Reporte PDF con hallazgos
- Exportación a S3

### 6. Inspecciones de Equipos de Emergencia
Inspección de extintores, camillas, botiquines, etc.:
- Catálogo maestro de equipos
- Inspección con detalle por equipo
- Historial de inspecciones

### 7. Inventario EPP (Insumos)
Control de stock de EPP y otros insumos SST:
- Catálogo de insumos con categorías
- Movimientos de entrada/salida
- Stock mínimo con alertas
- Integración con entregas (descuenta stock al entregar)

### 8. Plan Anual de Capacitaciones
Programación anual de capacitaciones SST:
- Temas según matriz de riesgos
- Periodicidad y responsables
- Estado de ejecución
- Vinculación con registros de asistencia

### 9. PVE Osteomuscular
Programa de Vigilancia Epidemiológica:
- Seguimiento a riesgo osteomuscular
- Encuestas y evaluaciones periódicas
- Indicadores de gestión

## Modelo de Datos Principal

### Personal (Base: Personal)
| Campo | Tipo | Descripción |
|---|---|---|
| ID Empleado | Texto | Identificador único |
| Nombre Completo | Texto | Nombre completo |
| Número Documento | Texto | Cédula de ciudadanía |
| Tipo Personal | Select | Planta / Contratista / Temporal |
| Estado Actividad | Select | Activo / Inactivo / Retirado |
| Accesos Asignados | Link | Apps autorizadas |
| Áreas | Link | Áreas asignadas |
| Rol | Link | Rol de permisos |
| Password | Texto | Hash bcrypt (12 rounds) |

### Entregas EPP (Base: SG-SST)
| Campo | Tipo | Descripción |
|---|---|---|
| ID Entrega | Auto | Código único |
| Fecha Entrega | Fecha | Cuándo se entregó |
| Responsable | Link | Quién entregó |
| Observaciones | Texto largo | Notas |
| Fecha Confirmación | Fecha | Firma del receptor |

### Inspecciones EPP (Base: SG-SST)
| Campo | Tipo | Descripción |
|---|---|---|
| Fecha | Fecha | Fecha de inspección |
| Inspector | Link/Texto | Quién inspeccionó |
| Area | Texto | Área inspeccionada |
| Estado General | Select | Conforme / No conforme |

### Equipos Emergencia (Base: SG-SST)
| Campo | Tipo | Descripción |
|---|---|---|
| Nombre | Texto | Ej: "Extintor PQS 10lb" |
| Tipo | Select | Extintor / Camilla / Botiquín... |
| Ubicación | Texto | Dónde está ubicado |
| Estado | Select | Activo / Fuera de servicio |

### Insumos EPP (Base: Insumos)
| Campo | Tipo | Descripción |
|---|---|---|
| Código | Texto | Código interno |
| Nombre | Texto | Nombre del insumo |
| Unidad Medida | Select | Unidad / Par / Kit |
| Stock Mínimo | Número | Cantidad mínima |
| Categoría | Link | Categoría (EPP, etc.) |

## Relaciones entre Módulos

```
Plan Anual (Programación)
    ↓ (ejecutar)
Registros Asistencia (Eventos)
    ├── Evaluaciones (post-capacitación)
    └── Firma digital (tokens)

Inventario EPP (Stock)
    ↓ (descuenta stock)
Entregas EPP
    ├── Detalle Entrega (items)
    ├── Historial por Empleado
    └── Firma digital (tokens)

Equipos Emergencia (Catálogo)
    ↓ (inspeccionar)
Inspecciones Equipos
    └── Detalle Inspección

Personal
    ├── Entregas EPP (receptor)
    ├── Inspecciones EPP (inspector)
    ├── Asistencia (asistente)
    └── Evaluaciones (evaluado)
```

## Comités SST (Colombia)

| Comité | Sigla | Función |
|---|---|---|
| Comité Paritario de SST | COPASST | Vigilancia del SG-SST |
| Comité de Convivencia Laboral | CCL | Prevención acoso laboral |
| Brigada de Emergencias | Brigada | Respuesta a emergencias |

Los comités se usan para filtrar asistentes en capacitaciones (auto-asignar miembros).

## Normatividad Clave

| Norma | Tema |
|---|---|
| Decreto 1072/2015 | Marco general SG-SST |
| Resolución 0312/2019 | Estándares mínimos |
| Resolución 1409/2012 | Trabajo en alturas |
| Resolución 2400/1979 | Higiene y seguridad industrial |
| Resolución 2013/1986 | COPASST |
| Ley 1562/2012 | Sistema de riesgos laborales |

## Indicadores SST

Los indicadores típicos que maneja el sistema:
- % de capacitaciones ejecutadas vs programadas
- % de empleados con EPP al día
- % de equipos de emergencia conformes
- Tasa de accidentalidad
- Cobertura de evaluaciones post-capacitación
