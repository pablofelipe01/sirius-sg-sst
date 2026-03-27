// ══════════════════════════════════════════════════════════
// Configuración Airtable — Base "Sirius SG-SST"
// Tablas de entregas EPP, detalle, tokens y historial
// ══════════════════════════════════════════════════════════

export const airtableSGSSTConfig = {
  apiToken: process.env.AIRTABLE_SGSST_API_TOKEN!,
  baseId: process.env.AIRTABLE_SGSST_BASE_ID!,
  baseUrl: "https://api.airtable.com/v0",

  // ── Tabla "Entregas EPP" ──────────────────────────────
  entregasTableId: process.env.AIRTABLE_ENTREGAS_TABLE_ID!,
  entregasFields: {
    ID_ENTREGA: process.env.AIRTABLE_ENT_ID_ENTREGA!,
    ID: process.env.AIRTABLE_ENT_ID!,
    FECHA_ENTREGA: process.env.AIRTABLE_ENT_FECHA_ENTREGA!,
    RESPONSABLE: process.env.AIRTABLE_ENT_RESPONSABLE!,
    OBSERVACIONES: process.env.AIRTABLE_ENT_OBSERVACIONES!,
    FECHA_CONFIRMACION: process.env.AIRTABLE_ENT_FECHA_CONFIRMACION!,
    DETALLE_LINK: process.env.AIRTABLE_ENT_DETALLE_LINK!,
    TOKENS_LINK: process.env.AIRTABLE_ENT_TOKENS_LINK!,
    ACTIVIDADES_SST: process.env.AIRTABLE_ENT_ACTIVIDADES_SST!,
    ID_EMPLEADO_CORE: process.env.AIRTABLE_ENT_ID_EMPLEADO_CORE!,
    ESTADO: process.env.AIRTABLE_ENT_ESTADO!,
    MOTIVO: process.env.AIRTABLE_ENT_MOTIVO!,
    HISTORIAL_LINK: process.env.AIRTABLE_ENT_HISTORIAL_LINK!,
  },

  // ── Tabla "Detalle Entrega EPP" ───────────────────────
  detalleTableId: process.env.AIRTABLE_DETALLE_TABLE_ID!,
  detalleFields: {
    ID: process.env.AIRTABLE_DET_ID!,
    CANTIDAD: process.env.AIRTABLE_DET_CANTIDAD!,
    VIDA_UTIL: process.env.AIRTABLE_DET_VIDA_UTIL!,
    FECHA_VENCIMIENTO: process.env.AIRTABLE_DET_FECHA_VENCIMIENTO!,
    OBSERVACIONES: process.env.AIRTABLE_DET_OBSERVACIONES!,
    ENTREGA_LINK: process.env.AIRTABLE_DET_ENTREGA_LINK!,
    TALLA: process.env.AIRTABLE_DET_TALLA!,
    CONDICION: process.env.AIRTABLE_DET_CONDICION!,
    CODIGO_INSUMO: process.env.AIRTABLE_DET_CODIGO_INSUMO!,
  },

  // ── Tabla "Tokens Entrega" ────────────────────────────
  tokensTableId: process.env.AIRTABLE_TOKENS_TABLE_ID!,
  tokensFields: {
    TOKEN_ID: process.env.AIRTABLE_TOK_TOKEN_ID!,
    FECHA_GENERACION: process.env.AIRTABLE_TOK_FECHA_GENERACION!,
    FECHA_EXPIRACION: process.env.AIRTABLE_TOK_FECHA_EXPIRACION!,
    TIPO_VERIFICACION: process.env.AIRTABLE_TOK_TIPO_VERIFICACION!,
    HASH_FIRMA: process.env.AIRTABLE_TOK_HASH_FIRMA!,
    ENTREGA_LINK: process.env.AIRTABLE_TOK_ENTREGA_LINK!,
    ID_EMPLEADO_CORE: process.env.AIRTABLE_TOK_ID_EMPLEADO_CORE!,
    ESTADO: process.env.AIRTABLE_TOK_ESTADO!,
  },

  // ── Tabla "Historial EPP Empleado" ────────────────────
  historialTableId: process.env.AIRTABLE_HIST_TABLE_ID!,
  historialFields: {
    DIAS_RESTANTES: process.env.AIRTABLE_HIST_DIAS_RESTANTES!,
    FECHA_ENTREGA: process.env.AIRTABLE_HIST_FECHA_ENTREGA!,
    FECHA_VENCIMIENTO: process.env.AIRTABLE_HIST_FECHA_VENCIMIENTO!,
    ESTADO: process.env.AIRTABLE_HIST_ESTADO!,
    ID_EMPLEADO_CORE: process.env.AIRTABLE_HIST_ID_EMPLEADO_CORE!,
    REQUIERE_REPOSICION: process.env.AIRTABLE_HIST_REQUIERE_REPOSICION!,
    ENTREGA_ORIGEN: process.env.AIRTABLE_HIST_ENTREGA_ORIGEN!,
    CODIGO_INSUMO: process.env.AIRTABLE_HIST_CODIGO_INSUMO!,
  },

  // ── Tabla "Inspecciones EPP" (cabecera) ───────────────
  inspeccionesTableId: process.env.AIRTABLE_INSP_TABLE_ID!,
  inspeccionesFields: {
    ID: process.env.AIRTABLE_INSP_ID!,
    FECHA: process.env.AIRTABLE_INSP_FECHA!,
    INSPECTOR: process.env.AIRTABLE_INSP_INSPECTOR!,
    ESTADO: process.env.AIRTABLE_INSP_ESTADO!,
    DETALLE_LINK: process.env.AIRTABLE_INSP_DETALLE_LINK!,
    // Campos para documentos exportados
    URL_DOCUMENTO: process.env.AIRTABLE_INSP_URL_DOCUMENTO!,
    FECHA_EXPORTACION: process.env.AIRTABLE_INSP_FECHA_EXPORTACION!,
    RESPONSABLE_FIRMANTE: process.env.AIRTABLE_INSP_RESPONSABLE_FIRMANTE!,
    COPASST_FIRMANTE: process.env.AIRTABLE_INSP_COPASST_FIRMANTE!,
  },

  // ── Tabla "Detalle Inspección EPP" ────────────────────
  detalleInspeccionTableId: process.env.AIRTABLE_DETINSP_TABLE_ID!,
  detalleInspeccionFields: {
    ID: process.env.AIRTABLE_DETINSP_ID!,
    ID_EMPLEADO: process.env.AIRTABLE_DETINSP_ID_EMPLEADO!,
    NOMBRE: process.env.AIRTABLE_DETINSP_NOMBRE!,
    OBSERVACIONES: process.env.AIRTABLE_DETINSP_OBSERVACIONES!,
    FIRMA: process.env.AIRTABLE_DETINSP_FIRMA!,
    INSPECCION_LINK: process.env.AIRTABLE_DETINSP_INSPECCION_LINK!,
    CASCO: process.env.AIRTABLE_DETINSP_CASCO!,
    P_AUDITIVA: process.env.AIRTABLE_DETINSP_P_AUDITIVA!,
    P_VISUAL: process.env.AIRTABLE_DETINSP_P_VISUAL!,
    P_RESPIRATORIA: process.env.AIRTABLE_DETINSP_P_RESPIRATORIA!,
    ROPA: process.env.AIRTABLE_DETINSP_ROPA!,
    GUANTES: process.env.AIRTABLE_DETINSP_GUANTES!,
    BOTAS: process.env.AIRTABLE_DETINSP_BOTAS!,
    P_CAIDAS: process.env.AIRTABLE_DETINSP_P_CAIDAS!,
    OTROS: process.env.AIRTABLE_DETINSP_OTROS!,
  },

  // ── Tabla "Equipos Emergencia" (catálogo maestro) ─────
  equiposTableId: process.env.AIRTABLE_EQUIP_TABLE_ID!,
  equiposFields: {
    CODIGO: process.env.AIRTABLE_EQUIP_CODIGO!,
    NOMBRE: process.env.AIRTABLE_EQUIP_NOMBRE!,
    CATEGORIA: process.env.AIRTABLE_EQUIP_CATEGORIA!,
    TIPO_ESPECIFICO: process.env.AIRTABLE_EQUIP_TIPO_ESPECIFICO!,
    AREA: process.env.AIRTABLE_EQUIP_AREA!,
    ID_AREA_CORE: process.env.AIRTABLE_EQUIP_ID_AREA_CORE!, // FK simbólica a Sirius Nómina Core
    UBICACION: process.env.AIRTABLE_EQUIP_UBICACION!,
    CAPACIDAD: process.env.AIRTABLE_EQUIP_CAPACIDAD!,
    FECHA_VENCIMIENTO: process.env.AIRTABLE_EQUIP_FECHA_VENCIMIENTO!,
    ESTADO: process.env.AIRTABLE_EQUIP_ESTADO!,
    DESCRIPCION: process.env.AIRTABLE_EQUIP_DESCRIPCION!,
  },

  // ── Tabla "Inspecciones Equipos Emergencia" (cabecera) ─
  inspEquiposTableId: process.env.AIRTABLE_INSPEQ_TABLE_ID!,
  inspEquiposFields: {
    ID: process.env.AIRTABLE_INSPEQ_ID!,
    FECHA: process.env.AIRTABLE_INSPEQ_FECHA!,
    INSPECTOR: process.env.AIRTABLE_INSPEQ_INSPECTOR!,
    ESTADO: process.env.AIRTABLE_INSPEQ_ESTADO!,
    OBSERVACIONES: process.env.AIRTABLE_INSPEQ_OBSERVACIONES!,
    URL_DOCUMENTO: process.env.AIRTABLE_INSPEQ_URL_DOCUMENTO!,
    FECHA_EXPORTACION: process.env.AIRTABLE_INSPEQ_FECHA_EXPORTACION!,
  },

  // ── Tabla "Detalle Inspección Equipos" ────────────────
  detalleEquiposTableId: process.env.AIRTABLE_DETEQ_TABLE_ID!,
  detalleEquiposFields: {
    ID: process.env.AIRTABLE_DETEQ_ID!,
    INSPECCION_LINK: process.env.AIRTABLE_DETEQ_INSPECCION_LINK!,
    EQUIPO_LINK: process.env.AIRTABLE_DETEQ_EQUIPO_LINK!,
    CATEGORIA: process.env.AIRTABLE_DETEQ_CATEGORIA!,
    AREA: process.env.AIRTABLE_DETEQ_AREA!,
    ESTADO_GENERAL: process.env.AIRTABLE_DETEQ_ESTADO_GENERAL!,
    SENALIZACION: process.env.AIRTABLE_DETEQ_SENALIZACION!,
    ACCESIBILIDAD: process.env.AIRTABLE_DETEQ_ACCESIBILIDAD!,
    // Criterios Extintor
    PRESION_MANOMETRO: process.env.AIRTABLE_DETEQ_PRESION_MANOMETRO!,
    MANGUERA: process.env.AIRTABLE_DETEQ_MANGUERA!,
    PIN_SEGURIDAD: process.env.AIRTABLE_DETEQ_PIN_SEGURIDAD!,
    SOPORTE_BASE: process.env.AIRTABLE_DETEQ_SOPORTE_BASE!,
    // Criterios Botiquín / Kit Derrames
    COMPLETITUD: process.env.AIRTABLE_DETEQ_COMPLETITUD!,
    ESTADO_CONTENEDOR: process.env.AIRTABLE_DETEQ_ESTADO_CONTENEDOR!,
    // Criterios Camilla
    ESTRUCTURA: process.env.AIRTABLE_DETEQ_ESTRUCTURA!,
    CORREAS: process.env.AIRTABLE_DETEQ_CORREAS!,
    // Comunes
    FECHA_VENCIMIENTO: process.env.AIRTABLE_DETEQ_FECHA_VENCIMIENTO!,
    OBSERVACIONES: process.env.AIRTABLE_DETEQ_OBSERVACIONES!,
  },

  // ── Tabla "Responsables Inspección Equipos" ───────────
  respEquiposTableId: process.env.AIRTABLE_RESPEQ_TABLE_ID!,
  respEquiposFields: {
    ID_FIRMA: process.env.AIRTABLE_RESPEQ_ID_FIRMA!,
    INSPECCION_LINK: process.env.AIRTABLE_RESPEQ_INSPECCION_LINK!,
    TIPO: process.env.AIRTABLE_RESPEQ_TIPO!,
    NOMBRE: process.env.AIRTABLE_RESPEQ_NOMBRE!,
    CEDULA: process.env.AIRTABLE_RESPEQ_CEDULA!,
    CARGO: process.env.AIRTABLE_RESPEQ_CARGO!,
    FIRMA: process.env.AIRTABLE_RESPEQ_FIRMA!,
    FECHA_FIRMA: process.env.AIRTABLE_RESPEQ_FECHA_FIRMA!,
  },

  // ── Tabla "Capacitaciones" (catálogo de temas) ────────
  capacitacionesTableId: process.env.AIRTABLE_CAP_TABLE_ID!,
  capacitacionesFields: {
    CODIGO:     process.env.AIRTABLE_CAP_CODIGO!,
    NOMBRE:     process.env.AIRTABLE_CAP_NOMBRE!,
    INTENSIDAD: process.env.AIRTABLE_CAP_INTENSIDAD!,
    TIPO:       process.env.AIRTABLE_CAP_TIPO!,
    CATEGORIA:  process.env.AIRTABLE_CAP_CATEGORIA!,
    POBLACION:  process.env.AIRTABLE_CAP_POBLACION!,
  },

  // ── Tabla "Programación Capacitaciones" ───────────────
  programacionCapacitacionesTableId: process.env.AIRTABLE_PROG_TABLE_ID!,
  programacionCapacitacionesFields: {
    IDENTIFICADOR:     process.env.AIRTABLE_PROG_IDENTIFICADOR!,
    MES:               process.env.AIRTABLE_PROG_MES!,
    TRIMESTRE:         process.env.AIRTABLE_PROG_TRIMESTRE!,
    PROGRAMADO:        process.env.AIRTABLE_PROG_PROGRAMADO!,
    EJECUTADO:         process.env.AIRTABLE_PROG_EJECUTADO!,
    FECHA_EJECUCION:   process.env.AIRTABLE_PROG_FECHA_EJECUCION!,
    TOTAL_ASISTENTES:  process.env.AIRTABLE_PROG_TOTAL_ASISTENTES!,
    CAPACITACION_LINK:  process.env.AIRTABLE_PROG_CAPACITACION_LINK!,
    EVENTOS_LINK:       process.env.AIRTABLE_PROG_EVENTOS_LINK!,
    OBSERVACIONES:      process.env.AIRTABLE_PROG_OBSERVACIONES!,
    ASISTENCIA_LINK:    process.env.AIRTABLE_PROG_ASISTENCIA_LINK!,
  },

  // ── Tabla "Eventos Capacitación" (cabecera de eventos) ─
  eventosCapacitacionTableId: process.env.AIRTABLE_EVT_TABLE_ID!,
  eventosCapacitacionFields: {
    CODIGO:               process.env.AIRTABLE_EVT_CODIGO!,
    CIUDAD:               process.env.AIRTABLE_EVT_CIUDAD!,
    LUGAR:                process.env.AIRTABLE_EVT_LUGAR!,
    FECHA:                process.env.AIRTABLE_EVT_FECHA!,
    HORA_INICIO:          process.env.AIRTABLE_EVT_HORA_INICIO!,
    DURACION:             process.env.AIRTABLE_EVT_DURACION!,
    AREA:                 process.env.AIRTABLE_EVT_AREA!,
    TIPO:                 process.env.AIRTABLE_EVT_TIPO!,
    TEMAS_TRATADOS:       process.env.AIRTABLE_EVT_TEMAS_TRATADOS!,
    NOMBRE_CONFERENCISTA: process.env.AIRTABLE_EVT_NOMBRE_CONFERENCISTA!,
    ESTADO:               process.env.AIRTABLE_EVT_ESTADO!,
    ASISTENCIA_LINK:      process.env.AIRTABLE_EVT_ASISTENCIA_LINK!,
    PROGRAMACION_LINK:    process.env.AIRTABLE_EVT_PROGRAMACION_LINK!,
    FIRMA_CONFERENCISTA:  process.env.AIRTABLE_EVT_FIRMA_CONFERENCISTA!,
  },

  // ── Tabla "Asistencia Capacitaciones" (detalle) ───────
  asistenciaCapacitacionesTableId: process.env.AIRTABLE_ASIS_TABLE_ID!,
  asistenciaCapacitacionesFields: {
    ID_ASISTENCIA:    process.env.AIRTABLE_ASIS_ID_ASISTENCIA!,
    NOMBRES:          process.env.AIRTABLE_ASIS_NOMBRES!,
    CEDULA:           process.env.AIRTABLE_ASIS_CEDULA!,
    LABOR:            process.env.AIRTABLE_ASIS_LABOR!,
    FIRMA_CONFIRMADA: process.env.AIRTABLE_ASIS_FIRMA_CONFIRMADA!,
    FECHA_REGISTRO:   process.env.AIRTABLE_ASIS_FECHA_REGISTRO!,
    EVENTO_LINK:        process.env.AIRTABLE_ASIS_EVENTO_LINK!,
    ID_EMPLEADO_CORE:   process.env.AIRTABLE_ASIS_ID_EMPLEADO_CORE!,
    PROGRAMACION_LINK:  process.env.AIRTABLE_ASIS_PROGRAMACION_LINK!,
    FIRMA:              process.env.AIRTABLE_ASIS_FIRMA!,
  },

  // ── Tabla "Banco de Preguntas" ────────────────────────
  bancoPreguntasTableId: process.env.AIRTABLE_PRG_BANCO_TABLE_ID!,
  bancoPreguntasFields: {
    CODIGO:             process.env.AIRTABLE_PRG_BANCO_CODIGO!,
    TEXTO:              process.env.AIRTABLE_PRG_BANCO_TEXTO!,
    TIPO:               process.env.AIRTABLE_PRG_BANCO_TIPO!,
    OPCIONES_JSON:      process.env.AIRTABLE_PRG_BANCO_OPCIONES_JSON!,
    RESPUESTA_CORRECTA: process.env.AIRTABLE_PRG_BANCO_RESPUESTA_CORRECTA!,
    CATEGORIA:          process.env.AIRTABLE_PRG_BANCO_CATEGORIA!,
    DIFICULTAD:         process.env.AIRTABLE_PRG_BANCO_DIFICULTAD!,
    ESTADO:             process.env.AIRTABLE_PRG_BANCO_ESTADO!,
    PUNTAJE_BASE:       process.env.AIRTABLE_PRG_BANCO_PUNTAJE_BASE!,
    EXPLICACION:        process.env.AIRTABLE_PRG_BANCO_EXPLICACION!,
  },

  // ── Tabla "Plantillas Evaluación" ─────────────────────
  plantillasEvalTableId: process.env.AIRTABLE_PLNT_TABLE_ID!,
  plantillasEvalFields: {
    CODIGO:           process.env.AIRTABLE_PLNT_CODIGO!,
    NOMBRE:           process.env.AIRTABLE_PLNT_NOMBRE!,
    DESCRIPCION:      process.env.AIRTABLE_PLNT_DESCRIPCION!,
    TIPO:             process.env.AIRTABLE_PLNT_TIPO!,
    PUNTAJE_MINIMO:   process.env.AIRTABLE_PLNT_PUNTAJE_MINIMO!,
    TIEMPO_LIMITE:    process.env.AIRTABLE_PLNT_TIEMPO_LIMITE!,
    INTENTOS:         process.env.AIRTABLE_PLNT_INTENTOS!,
    ALEATORIZAR:      process.env.AIRTABLE_PLNT_ALEATORIZAR!,
    MOSTRAR_RETRO:    process.env.AIRTABLE_PLNT_MOSTRAR_RETRO!,
    ESTADO:           process.env.AIRTABLE_PLNT_ESTADO!,
    VIGENCIA:         process.env.AIRTABLE_PLNT_VIGENCIA!,
    PREGUNTAS_LINK:   process.env.AIRTABLE_PLNT_PREGUNTAS_LINK!,
    POBLACION:        process.env.AIRTABLE_PLNT_POBLACION!,
    CATEGORIAS:       process.env.AIRTABLE_PLNT_CATEGORIAS!,
    PROGRAMACIONES:   process.env.AIRTABLE_PLNT_PROGRAMACIONES!,
  },

  // ── Tabla "Preguntas por Plantilla" ───────────────────
  pregXPlantTableId: process.env.AIRTABLE_PXPL_TABLE_ID!,
  pregXPlantFields: {
    CODIGO:      process.env.AIRTABLE_PXPL_CODIGO!,
    PLANTILLA:   process.env.AIRTABLE_PXPL_PLANTILLA!,
    PREGUNTA:    process.env.AIRTABLE_PXPL_PREGUNTA!,
    ORDEN:       process.env.AIRTABLE_PXPL_ORDEN!,
    PUNTAJE:     process.env.AIRTABLE_PXPL_PUNTAJE!,
    OBLIGATORIA: process.env.AIRTABLE_PXPL_OBLIGATORIA!,
  },

  // ── Tabla "Evaluaciones Aplicadas" ────────────────────
  evalAplicadasTableId: process.env.AIRTABLE_EVALAP_TABLE_ID!,
  evalAplicadasFields: {
    ID:           process.env.AIRTABLE_EVALAP_ID!,
    PLANTILLA:    process.env.AIRTABLE_EVALAP_PLANTILLA!,
    PROG_MENSUAL: process.env.AIRTABLE_EVALAP_PROG_MENSUAL!,
    FECHA:        process.env.AIRTABLE_EVALAP_FECHA!,
    ID_EMPLEADO:  process.env.AIRTABLE_EVALAP_ID_EMPLEADO!,
    NOMBRES:      process.env.AIRTABLE_EVALAP_NOMBRES!,
    CEDULA:       process.env.AIRTABLE_EVALAP_CEDULA!,
    CARGO:        process.env.AIRTABLE_EVALAP_CARGO!,
    PUNTAJE_OBT:  process.env.AIRTABLE_EVALAP_PUNTAJE_OBT!,
    PUNTAJE_MAX:  process.env.AIRTABLE_EVALAP_PUNTAJE_MAX!,
    PORCENTAJE:   process.env.AIRTABLE_EVALAP_PORCENTAJE!,
    ESTADO:       process.env.AIRTABLE_EVALAP_ESTADO!,
    INTENTO:      process.env.AIRTABLE_EVALAP_INTENTO!,
    TIEMPO:       process.env.AIRTABLE_EVALAP_TIEMPO!,
    EVALUADOR:    process.env.AIRTABLE_EVALAP_EVALUADOR!,
    OBSERVACIONES: process.env.AIRTABLE_EVALAP_OBSERVACIONES!,
    PROG_CAP:     process.env.AIRTABLE_EVALAP_PROG_CAP!,
    RESP_LINK:    process.env.AIRTABLE_EVALAP_RESP_LINK!,
  },

  // ── Tabla "Respuestas Evaluación" ─────────────────────
  respEvalTableId: process.env.AIRTABLE_RESP_TABLE_ID!,
  respEvalFields: {
    ID:            process.env.AIRTABLE_RESP_ID!,
    EVALUACION:    process.env.AIRTABLE_RESP_EVALUACION!,
    PREGUNTA:      process.env.AIRTABLE_RESP_PREGUNTA!,
    RESPUESTA_DADA: process.env.AIRTABLE_RESP_RESPUESTA_DADA!,
    ES_CORRECTA:   process.env.AIRTABLE_RESP_ES_CORRECTA!,
    PUNTAJE:       process.env.AIRTABLE_RESP_PUNTAJE!,
    TIEMPO_SEG:    process.env.AIRTABLE_RESP_TIEMPO_SEG!,
    ORDEN:         process.env.AIRTABLE_RESP_ORDEN!,
  },

  // ── Tabla "Miembros Comités SST" ──────────────────────
  miembrosComitesTableId: process.env.AIRTABLE_MBR_TABLE_ID!,
  miembrosComitesFields: {
    ID:            process.env.AIRTABLE_MBR_ID!,
    ID_EMPLEADO:   process.env.AIRTABLE_MBR_ID_EMPLEADO!,
    NOMBRE:        process.env.AIRTABLE_MBR_NOMBRE!,
    DOCUMENTO:     process.env.AIRTABLE_MBR_DOCUMENTO!,
    CARGO:         process.env.AIRTABLE_MBR_CARGO!,
    COMITE:        process.env.AIRTABLE_MBR_COMITE!,
    ROL:           process.env.AIRTABLE_MBR_ROL!,
    REPRESENTACION: process.env.AIRTABLE_MBR_REPRESENTACION!,
    ESTADO:        process.env.AIRTABLE_MBR_ESTADO!,
    EXCLUIR_ASISTENCIA: process.env.AIRTABLE_MBR_EXCLUIR_ASISTENCIA!,
  },

  // ── Tabla "Inspecciones Áreas" (cabecera) ─────────────
  inspeccionesAreasTableId: process.env.AIRTABLE_INSPA_TABLE_ID!,
  inspeccionesAreasFields: {
    ID:                   process.env.AIRTABLE_INSPA_ID!,
    FECHA:                process.env.AIRTABLE_INSPA_FECHA!,
    INSPECTOR:            process.env.AIRTABLE_INSPA_INSPECTOR!,
    AREA:                 process.env.AIRTABLE_INSPA_AREA!,
    ESTADO:               process.env.AIRTABLE_INSPA_ESTADO!,
    OBSERVACIONES:        process.env.AIRTABLE_INSPA_OBSERVACIONES!,
    URL_DOCUMENTO:        process.env.AIRTABLE_INSPA_URL_DOCUMENTO!,
    FECHA_EXPORTACION:    process.env.AIRTABLE_INSPA_FECHA_EXPORTACION!,
    DETALLE_LINK:         process.env.AIRTABLE_INSPA_DETALLE_LINK!,
    RESPONSABLES_LINK:    process.env.AIRTABLE_INSPA_RESPONSABLES_LINK!,
    ACCIONES_LINK:        process.env.AIRTABLE_INSPA_ACCIONES_LINK!,
  },

  // ── Tabla "Detalle Inspección Áreas" ──────────────────
  detalleInspeccionAreasTableId: process.env.AIRTABLE_DETINSPA_TABLE_ID!,
  detalleInspeccionAreasFields: {
    ID:                process.env.AIRTABLE_DETINSPA_ID!,
    INSPECCION_LINK:   process.env.AIRTABLE_DETINSPA_INSPECCION_LINK!,
    CATEGORIA:         process.env.AIRTABLE_DETINSPA_CATEGORIA!,
    CRITERIO:          process.env.AIRTABLE_DETINSPA_CRITERIO!,
    CONDICION:         process.env.AIRTABLE_DETINSPA_CONDICION!,
    OBSERVACION:       process.env.AIRTABLE_DETINSPA_OBSERVACION!,
  },

  // ── Tabla "Responsables Inspección Áreas" ─────────────
  respInspeccionAreasTableId: process.env.AIRTABLE_RESPINSPA_TABLE_ID!,
  respInspeccionAreasFields: {
    ID_FIRMA:         process.env.AIRTABLE_RESPINSPA_ID_FIRMA!,
    INSPECCION_LINK:  process.env.AIRTABLE_RESPINSPA_INSPECCION_LINK!,
    TIPO:             process.env.AIRTABLE_RESPINSPA_TIPO!,
    NOMBRE:           process.env.AIRTABLE_RESPINSPA_NOMBRE!,
    CEDULA:           process.env.AIRTABLE_RESPINSPA_CEDULA!,
    CARGO:            process.env.AIRTABLE_RESPINSPA_CARGO!,
    FIRMA:            process.env.AIRTABLE_RESPINSPA_FIRMA!,
    FECHA_FIRMA:      process.env.AIRTABLE_RESPINSPA_FECHA_FIRMA!,
  },

  // ── Tabla "Acciones Correctivas Áreas" ────────────────
  accionesCorrectivasAreasTableId: process.env.AIRTABLE_ACCINSPA_TABLE_ID!,
  accionesCorrectivasAreasFields: {
    ID:                process.env.AIRTABLE_ACCINSPA_ID!,
    INSPECCION_LINK:   process.env.AIRTABLE_ACCINSPA_INSPECCION_LINK!,
    DESCRIPCION:       process.env.AIRTABLE_ACCINSPA_DESCRIPCION!,
    TIPO:              process.env.AIRTABLE_ACCINSPA_TIPO!,
    RESPONSABLE:       process.env.AIRTABLE_ACCINSPA_RESPONSABLE!,
    FECHA_PROPUESTA:   process.env.AIRTABLE_ACCINSPA_FECHA_PROPUESTA!,
    ESTADO:            process.env.AIRTABLE_ACCINSPA_ESTADO!,
    FECHA_CIERRE:      process.env.AIRTABLE_ACCINSPA_FECHA_CIERRE!,
    EVIDENCIA_URL:     process.env.AIRTABLE_ACCINSPA_EVIDENCIA_URL!,
    CRITERIO_LINK:     process.env.AIRTABLE_ACCINSPA_CRITERIO_LINK!,
  },

  // ══════════════════════════════════════════════════════════
  // INSPECCIONES ESPECÍFICAS DE EQUIPOS
  // ══════════════════════════════════════════════════════════

  // ── Tabla "Inspecciones Botiquín" (Cabecera) ──────────────
  inspBotiquinTableId: process.env.AIRTABLE_INSPBOT_TABLE_ID!,
  inspBotiquinFields: {
    ID:                  process.env.AIRTABLE_INSPBOT_ID!,
    FECHA:               process.env.AIRTABLE_INSPBOT_FECHA!,
    INSPECTOR:           process.env.AIRTABLE_INSPBOT_INSPECTOR!,
    CARGO_INSPECTOR:     process.env.AIRTABLE_INSPBOT_CARGO_INSPECTOR!,
    ESTADO:              process.env.AIRTABLE_INSPBOT_ESTADO!,
    OBSERVACIONES:       process.env.AIRTABLE_INSPBOT_OBSERVACIONES!,
    URL_DOCUMENTO:       process.env.AIRTABLE_INSPBOT_URL_DOCUMENTO!,
    FECHA_EXPORTACION:   process.env.AIRTABLE_INSPBOT_FECHA_EXPORTACION!,
    DETALLE_LINK:        process.env.AIRTABLE_INSPBOT_DETALLE_LINK!,
    RESPONSABLES_LINK:   process.env.AIRTABLE_INSPBOT_RESPONSABLES_LINK!,
  },

  // ── Tabla "Detalle Inspección Botiquín" ───────────────────
  detalleBotiquinTableId: process.env.AIRTABLE_DETBOT_TABLE_ID!,
  detalleBotiquinFields: {
    ID:                process.env.AIRTABLE_DETBOT_ID!,
    INSPECCION_LINK:   process.env.AIRTABLE_DETBOT_INSPECCION_LINK!,
    BOTIQUIN_LINK:     process.env.AIRTABLE_DETBOT_BOTIQUIN_LINK!,
    ELEMENTO_LINK:     process.env.AIRTABLE_DETBOT_ELEMENTO_LINK!,
    ESTADO_ELEMENTO:   process.env.AIRTABLE_DETBOT_ESTADO_ELEMENTO!,
    CANTIDAD:          process.env.AIRTABLE_DETBOT_CANTIDAD!,
    FECHA_VENCIMIENTO: process.env.AIRTABLE_DETBOT_FECHA_VENCIMIENTO!,
    OBSERVACIONES:     process.env.AIRTABLE_DETBOT_OBSERVACIONES!,
  },

  // ── Tabla "Responsables Inspección Botiquín" ──────────────
  respBotiquinTableId: process.env.AIRTABLE_RESPBOT_TABLE_ID!,
  respBotiquinFields: {
    ID_FIRMA:          process.env.AIRTABLE_RESPBOT_ID_FIRMA!,
    INSPECCION_LINK:   process.env.AIRTABLE_RESPBOT_INSPECCION_LINK!,
    TIPO:              process.env.AIRTABLE_RESPBOT_TIPO!,
    NOMBRE:            process.env.AIRTABLE_RESPBOT_NOMBRE!,
    CARGO:             process.env.AIRTABLE_RESPBOT_CARGO!,
    FIRMADO:           process.env.AIRTABLE_RESPBOT_FIRMADO!,
    FECHA_FIRMA:       process.env.AIRTABLE_RESPBOT_FECHA_FIRMA!,
  },

  // ── Tabla "Botiquines" (Catálogo) ─────────────────────────
  botiquinesTableId: process.env.AIRTABLE_BOTIQUINES_TABLE_ID!,
  botiquinesFields: {
    CODIGO:            process.env.AIRTABLE_BOTIQUINES_CODIGO!,
    NOMBRE:            process.env.AIRTABLE_BOTIQUINES_NOMBRE!,
    TIPO_LINK:         process.env.AIRTABLE_BOTIQUINES_TIPO_LINK!,
    UBICACION_LINK:    process.env.AIRTABLE_BOTIQUINES_UBICACION_LINK!,
    ID_AREA_CORE:      process.env.AIRTABLE_BOTIQUINES_ID_AREA_CORE!, // FK simbólica a Sirius Nómina Core
    FECHA_INSTALACION: process.env.AIRTABLE_BOTIQUINES_FECHA_INSTALACION!,
    ESTADO:            process.env.AIRTABLE_BOTIQUINES_ESTADO!,
  },

  // ── Tabla "Catálogo Elementos Botiquín" ───────────────────
  elementosBotiquinTableId: process.env.AIRTABLE_ELEMBOT_TABLE_ID!,
  elementosBotiquinFields: {
    CODIGO:              process.env.AIRTABLE_ELEMBOT_CODIGO!,
    NOMBRE:              process.env.AIRTABLE_ELEMBOT_NOMBRE!,
    UNIDAD:              process.env.AIRTABLE_ELEMBOT_UNIDAD!,
    REQUIERE_VENCIMIENTO: process.env.AIRTABLE_ELEMBOT_REQUIERE_VENCIMIENTO!,
    DESCRIPCION:         process.env.AIRTABLE_ELEMBOT_DESCRIPCION!,
    ESTADO:              process.env.AIRTABLE_ELEMBOT_ESTADO!,
  },
};

export function getSGSSTUrl(tableId: string): string {
  return `${airtableSGSSTConfig.baseUrl}/${airtableSGSSTConfig.baseId}/${tableId}`;
}

export function getSGSSTHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${airtableSGSSTConfig.apiToken}`,
    "Content-Type": "application/json",
  };
}
