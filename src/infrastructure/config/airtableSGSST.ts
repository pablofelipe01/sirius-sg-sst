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
    FOTO_EVIDENCIA_URL: process.env.AIRTABLE_ENT_FOTO_EVIDENCIA_URL!,
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
    FOTO_URL: process.env.AIRTABLE_DETEQ_FOTO_URL!,
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
    FOTO_URL:             process.env.AIRTABLE_INSPA_FOTO_URL!,
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

  // ── Tabla "Inspecciones Extintor" (Cabecera) ──────────────
  inspExtintorTableId: process.env.AIRTABLE_INSPEXT_TABLE_ID!,
  inspExtintorFields: {
    ID:                  process.env.AIRTABLE_INSPEXT_ID!,
    FECHA:               process.env.AIRTABLE_INSPEXT_FECHA!,
    INSPECTOR:           process.env.AIRTABLE_INSPEXT_INSPECTOR!,
    CARGO_INSPECTOR:     process.env.AIRTABLE_INSPEXT_CARGO_INSPECTOR!,
    ESTADO:              process.env.AIRTABLE_INSPEXT_ESTADO!,
    OBSERVACIONES:       process.env.AIRTABLE_INSPEXT_OBSERVACIONES!,
    URL_DOCUMENTO:       process.env.AIRTABLE_INSPEXT_URL_DOCUMENTO!,
    FECHA_EXPORTACION:   process.env.AIRTABLE_INSPEXT_FECHA_EXPORTACION!,
    DETALLE_LINK:        process.env.AIRTABLE_INSPEXT_DETALLE_LINK!,
    RESPONSABLES_LINK:   process.env.AIRTABLE_INSPEXT_RESPONSABLES_LINK!,
  },

  // ── Tabla "Detalle Inspección Extintor" ───────────────────
  detalleExtintorTableId: process.env.AIRTABLE_DETEXT_TABLE_ID!,
  detalleExtintorFields: {
    ID:                process.env.AIRTABLE_DETEXT_ID!,
    INSPECCION_LINK:   process.env.AIRTABLE_DETEXT_INSPECCION_LINK!,
    EXTINTOR_LINK:     process.env.AIRTABLE_DETEXT_EXTINTOR_LINK!,
    INFO_SNAPSHOT_LINK: process.env.AIRTABLE_DETEXT_INFO_SNAPSHOT_LINK!,
    PRESION:           process.env.AIRTABLE_DETEXT_PRESION!,
    SELLO_GARANTIA:    process.env.AIRTABLE_DETEXT_SELLO_GARANTIA!,
    MANOMETRO:         process.env.AIRTABLE_DETEXT_MANOMETRO!,
    ESTADO_CILINDRO:   process.env.AIRTABLE_DETEXT_ESTADO_CILINDRO!,
    MANIJA:            process.env.AIRTABLE_DETEXT_MANIJA!,
    BOQUILLA_MANGUERA: process.env.AIRTABLE_DETEXT_BOQUILLA_MANGUERA!,
    ANILLO_SEGURIDAD:  process.env.AIRTABLE_DETEXT_ANILLO_SEGURIDAD!,
    PIN_SEGURIDAD:     process.env.AIRTABLE_DETEXT_PIN_SEGURIDAD!,
    PINTURA:           process.env.AIRTABLE_DETEXT_PINTURA!,
    TARJETA_INSPECCION: process.env.AIRTABLE_DETEXT_TARJETA_INSPECCION!,
    OBSERVACIONES:     process.env.AIRTABLE_DETEXT_OBSERVACIONES!,
  },

  // ── Tabla "Info Importante Extintor" (Snapshot) ───────────
  infoExtintorTableId: process.env.AIRTABLE_INFOEXT_TABLE_ID!,
  infoExtintorFields: {
    CLASE_AGENTE:       process.env.AIRTABLE_INFOEXT_CLASE_AGENTE!,
    TIPO_EXTINTOR:      process.env.AIRTABLE_INFOEXT_TIPO_EXTINTOR!,
    CAPACIDAD:          process.env.AIRTABLE_INFOEXT_CAPACIDAD!,
    FECHA_PROXIMA_RECARGA: process.env.AIRTABLE_INFOEXT_FECHA_PROXIMA_RECARGA!,
  },

  // ── Tabla "Responsables Inspección Extintor" ──────────────
  respExtintorTableId: process.env.AIRTABLE_RESPEXT_TABLE_ID!,
  respExtintorFields: {
    ID_FIRMA:          process.env.AIRTABLE_RESPEXT_ID_FIRMA!,
    INSPECCION_LINK:   process.env.AIRTABLE_RESPEXT_INSPECCION_LINK!,
    TIPO:              process.env.AIRTABLE_RESPEXT_TIPO!,
    NOMBRE:            process.env.AIRTABLE_RESPEXT_NOMBRE!,
    CARGO:             process.env.AIRTABLE_RESPEXT_CARGO!,
    FIRMADO:           process.env.AIRTABLE_RESPEXT_FIRMADO!,
    FECHA_FIRMA:       process.env.AIRTABLE_RESPEXT_FECHA_FIRMA!,
  },

  // ── Tabla "Extintores" (Catálogo) ─────────────────────────
  extintoresTableId: process.env.AIRTABLE_EXTINTORES_TABLE_ID!,
  extintoresFields: {
    CODIGO:            process.env.AIRTABLE_EXTINTORES_CODIGO!,
    NOMBRE:            process.env.AIRTABLE_EXTINTORES_NOMBRE!,
    UBICACION:         process.env.AIRTABLE_EXTINTORES_UBICACION!,
    ESTADO:            process.env.AIRTABLE_EXTINTORES_ESTADO!,
  },

  // ── Tabla "Inspecciones Camilla" (Cabecera) ───────────────
  inspCamillaTableId: process.env.AIRTABLE_INSPCAM_TABLE_ID!,
  inspCamillaFields: {
    ID:                  process.env.AIRTABLE_INSPCAM_ID!,
    FECHA:               process.env.AIRTABLE_INSPCAM_FECHA!,
    INSPECTOR:           process.env.AIRTABLE_INSPCAM_INSPECTOR!,
    CARGO_INSPECTOR:     process.env.AIRTABLE_INSPCAM_CARGO_INSPECTOR!,
    ESTADO:              process.env.AIRTABLE_INSPCAM_ESTADO!,
    OBSERVACIONES:       process.env.AIRTABLE_INSPCAM_OBSERVACIONES!,
    URL_DOCUMENTO:       process.env.AIRTABLE_INSPCAM_URL_DOCUMENTO!,
    FECHA_EXPORTACION:   process.env.AIRTABLE_INSPCAM_FECHA_EXPORTACION!,
    DETALLE_LINK:        process.env.AIRTABLE_INSPCAM_DETALLE_LINK!,
    RESPONSABLES_LINK:   process.env.AIRTABLE_INSPCAM_RESPONSABLES_LINK!,
  },

  // ── Tabla "Detalle Inspección Camilla" ────────────────────
  detalleCamillaTableId: process.env.AIRTABLE_DETCAM_TABLE_ID!,
  detalleCamillaFields: {
    ID:                process.env.AIRTABLE_DETCAM_ID!,
    INSPECCION_LINK:   process.env.AIRTABLE_DETCAM_INSPECCION_LINK!,
    CAMILLA_LINK:      process.env.AIRTABLE_DETCAM_CAMILLA_LINK!,
    ELEMENTO_LINK:     process.env.AIRTABLE_DETCAM_ELEMENTO_LINK!,
    ESTADO_ELEMENTO:   process.env.AIRTABLE_DETCAM_ESTADO_ELEMENTO!,
    CANTIDAD:          process.env.AIRTABLE_DETCAM_CANTIDAD!,
    OBSERVACIONES:     process.env.AIRTABLE_DETCAM_OBSERVACIONES!,
  },

  // ── Tabla "Responsables Inspección Camilla" ───────────────
  respCamillaTableId: process.env.AIRTABLE_RESPCAM_TABLE_ID!,
  respCamillaFields: {
    ID_FIRMA:          process.env.AIRTABLE_RESPCAM_ID_FIRMA!,
    INSPECCION_LINK:   process.env.AIRTABLE_RESPCAM_INSPECCION_LINK!,
    TIPO:              process.env.AIRTABLE_RESPCAM_TIPO!,
    NOMBRE:            process.env.AIRTABLE_RESPCAM_NOMBRE!,
    CARGO:             process.env.AIRTABLE_RESPCAM_CARGO!,
    FIRMADO:           process.env.AIRTABLE_RESPCAM_FIRMADO!,
    FECHA_FIRMA:       process.env.AIRTABLE_RESPCAM_FECHA_FIRMA!,
  },

  // ── Tabla "Camillas" (Catálogo) ───────────────────────────
  camillasTableId: process.env.AIRTABLE_CAMILLAS_TABLE_ID!,
  camillasFields: {
    CODIGO:            process.env.AIRTABLE_CAMILLAS_CODIGO!,
    NOMBRE:            process.env.AIRTABLE_CAMILLAS_NOMBRE!,
    UBICACION:         process.env.AIRTABLE_CAMILLAS_UBICACION!,
    ESTADO:            process.env.AIRTABLE_CAMILLAS_ESTADO!,
  },

  // ── Tabla "Catálogo Elementos Camilla" ────────────────────
  elementosCamillaTableId: process.env.AIRTABLE_ELEMCAM_TABLE_ID!,
  elementosCamillaFields: {
    CODIGO:            process.env.AIRTABLE_ELEMCAM_CODIGO!,
    NOMBRE:            process.env.AIRTABLE_ELEMCAM_NOMBRE!,
    ESTADO:            process.env.AIRTABLE_ELEMCAM_ESTADO!,
  },

  // ── Tabla "Inspecciones Kit Derrames" (Cabecera) ──────────
  inspKitDerTableId: process.env.AIRTABLE_INSPKIT_TABLE_ID!,
  inspKitDerFields: {
    ID:                  process.env.AIRTABLE_INSPKIT_ID!,
    FECHA:               process.env.AIRTABLE_INSPKIT_FECHA!,
    INSPECTOR:           process.env.AIRTABLE_INSPKIT_INSPECTOR!,
    CARGO_INSPECTOR:     process.env.AIRTABLE_INSPKIT_CARGO_INSPECTOR!,
    ESTADO:              process.env.AIRTABLE_INSPKIT_ESTADO!,
    OBSERVACIONES:       process.env.AIRTABLE_INSPKIT_OBSERVACIONES!,
    URL_DOCUMENTO:       process.env.AIRTABLE_INSPKIT_URL_DOCUMENTO!,
    FECHA_EXPORTACION:   process.env.AIRTABLE_INSPKIT_FECHA_EXPORTACION!,
    DETALLE_LINK:        process.env.AIRTABLE_INSPKIT_DETALLE_LINK!,
    VERIFICACIONES_LINK: process.env.AIRTABLE_INSPKIT_VERIFICACIONES_LINK!,
    RESPONSABLES_LINK:   process.env.AIRTABLE_INSPKIT_RESPONSABLES_LINK!,
  },

  // ── Tabla "Detalle Inspección Kit Derrames" ───────────────
  detalleKitDerTableId: process.env.AIRTABLE_DETKIT_TABLE_ID!,
  detalleKitDerFields: {
    ID:                process.env.AIRTABLE_DETKIT_ID!,
    INSPECCION_LINK:   process.env.AIRTABLE_DETKIT_INSPECCION_LINK!,
    KIT_LINK:          process.env.AIRTABLE_DETKIT_KIT_LINK!,
    ELEMENTO_LINK:     process.env.AIRTABLE_DETKIT_ELEMENTO_LINK!,
    ESTADO_ELEMENTO:   process.env.AIRTABLE_DETKIT_ESTADO_ELEMENTO!,
    CANTIDAD:          process.env.AIRTABLE_DETKIT_CANTIDAD!,
    FECHA_VENCIMIENTO: process.env.AIRTABLE_DETKIT_FECHA_VENCIMIENTO!,
    OBSERVACIONES:     process.env.AIRTABLE_DETKIT_OBSERVACIONES!,
  },

  // ── Tabla "Verificaciones Kit Derrames" ───────────────────
  verificacionesKitDerTableId: process.env.AIRTABLE_VERKIT_TABLE_ID!,
  verificacionesKitDerFields: {
    ID:                      process.env.AIRTABLE_VERKIT_ID!,
    INSPECCION_LINK:         process.env.AIRTABLE_VERKIT_INSPECCION_LINK!,
    CONOCE_PROCEDIMIENTO:    process.env.AIRTABLE_VERKIT_CONOCE_PROCEDIMIENTO!,
    ALMACENAMIENTO_ADECUADO: process.env.AIRTABLE_VERKIT_ALMACENAMIENTO_ADECUADO!,
    ROTULADO_SENALIZADO:     process.env.AIRTABLE_VERKIT_ROTULADO_SENALIZADO!,
  },

  // ── Tabla "Responsables Inspección Kit Derrames" ──────────
  respKitDerTableId: process.env.AIRTABLE_RESPKIT_TABLE_ID!,
  respKitDerFields: {
    ID_FIRMA:          process.env.AIRTABLE_RESPKIT_ID_FIRMA!,
    INSPECCION_LINK:   process.env.AIRTABLE_RESPKIT_INSPECCION_LINK!,
    TIPO:              process.env.AIRTABLE_RESPKIT_TIPO!,
    NOMBRE:            process.env.AIRTABLE_RESPKIT_NOMBRE!,
    CARGO:             process.env.AIRTABLE_RESPKIT_CARGO!,
    FIRMADO:           process.env.AIRTABLE_RESPKIT_FIRMADO!,
    FECHA_FIRMA:       process.env.AIRTABLE_RESPKIT_FECHA_FIRMA!,
  },

  // ── Tabla "Kits Derrames" (Catálogo) ──────────────────────
  kitsDerTableId: process.env.AIRTABLE_KITSDER_TABLE_ID!,
  kitsDerFields: {
    CODIGO:            process.env.AIRTABLE_KITSDER_CODIGO!,
    NOMBRE:            process.env.AIRTABLE_KITSDER_NOMBRE!,
    UBICACION:         process.env.AIRTABLE_KITSDER_UBICACION!,
    ESTADO:            process.env.AIRTABLE_KITSDER_ESTADO!,
  },

  // ── Tabla "Catálogo Elementos Kit Derrames" ───────────────
  elementosKitDerTableId: process.env.AIRTABLE_ELEMKIT_TABLE_ID!,
  elementosKitDerFields: {
    CODIGO:            process.env.AIRTABLE_ELEMKIT_CODIGO!,
    NOMBRE:            process.env.AIRTABLE_ELEMKIT_NOMBRE!,
    ESTADO:            process.env.AIRTABLE_ELEMKIT_ESTADO!,
  },

  // ══════════════════════════════════════════════════════════
  // COMITÉ COPASST — Actas digitales (FT-SST-008 v001)
  // Decreto 1072/2015, Res. 0312/2019
  // ══════════════════════════════════════════════════════════

  // ── Tabla "copasst_actas" (cabecera) ──────────────────────
  copasstActasTableId: process.env.COPASST_ACTAS_TABLE_ID!,
  copasstActasFields: {
    ID:                          process.env.COPASST_ACTAS_ID_FIELD!,
    NUMERO_ACTA:                 process.env.COPASST_ACTAS_NUMERO_ACTA_FIELD!,
    MES_EVALUADO:                process.env.COPASST_ACTAS_MES_EVALUADO_FIELD!,
    FECHA_REUNION:               process.env.COPASST_ACTAS_FECHA_REUNION_FIELD!,
    HORA_INICIO:                 process.env.COPASST_ACTAS_HORA_INICIO_FIELD!,
    HORA_CIERRE:                 process.env.COPASST_ACTAS_HORA_CIERRE_FIELD!,
    LUGAR:                       process.env.COPASST_ACTAS_LUGAR_FIELD!,
    ACCIDENTES_PRESENTADOS:      process.env.COPASST_ACTAS_ACCIDENTES_FIELD!,
    ACCIDENTES_DETALLE:          process.env.COPASST_ACTAS_ACCIDENTES_DETALLE_FIELD!,
    INCIDENTES_PRESENTADOS:      process.env.COPASST_ACTAS_INCIDENTES_FIELD!,
    INCIDENTES_DETALLE:          process.env.COPASST_ACTAS_INCIDENTES_DETALLE_FIELD!,
    NOVEDADES_ADMINISTRATIVAS:   process.env.COPASST_ACTAS_NOVEDADES_FIELD!,
    ESTADO:                      process.env.COPASST_ACTAS_ESTADO_FIELD!,
    FIRMA_PRESIDENTE:            process.env.COPASST_ACTAS_FIRMA_PRESIDENTE_FIELD!,
    FIRMA_SECRETARIO:            process.env.COPASST_ACTAS_FIRMA_SECRETARIO_FIELD!,
    URL_DOCUMENTO:               process.env.COPASST_ACTAS_URL_DOCUMENTO_FIELD!,
    FECHA_EXPORTACION:           process.env.COPASST_ACTAS_FECHA_EXPORT_FIELD!,
    // Links a tablas existentes / compartidas
    ASISTENTES_LINK:             process.env.COPASST_ACTAS_ASISTENTES_LINK_FIELD!,    // → Miembros Comite SST
    CAPACITACIONES_PROG_LINK:    process.env.COPASST_ACTAS_CAPACITACIONES_LINK_FIELD!, // → Programación Capacitaciones
    CONDICIONES_LINK:            process.env.COPASST_ACTAS_CONDICIONES_LINK_FIELD!,   // → copasst_condiciones_inseguras
    COMPROMISOS_LINK:            process.env.COPASST_ACTAS_COMPROMISOS_LINK_FIELD!,   // → compromisos (compartida)
    CREATED_AT:                  process.env.COPASST_ACTAS_CREATED_AT_FIELD!,
    UPDATED_AT:                  process.env.COPASST_ACTAS_UPDATED_AT_FIELD!,
  },

  // ── Tabla "copasst_condiciones_inseguras" ─────────────────
  copasstCondicionesTableId: process.env.COPASST_CONDICIONES_TABLE_ID!,
  copasstCondicionesFields: {
    ID:           process.env.COPASST_CONDICIONES_ID_FIELD!,
    ACTA_LINK:    process.env.COPASST_CONDICIONES_ACTA_LINK_FIELD!,
    DESCRIPCION:  process.env.COPASST_CONDICIONES_DESCRIPCION_FIELD!,
    RESULTADO:    process.env.COPASST_CONDICIONES_RESULTADO_FIELD!,                   // ok|oportunidad_mejora|critico
    OBSERVACION:  process.env.COPASST_CONDICIONES_OBSERVACION_FIELD!,
  },

  // ══════════════════════════════════════════════════════════
  // COMITÉ COCOLAB — Actas digitales (F-TSST-017 v001)
  // Res. 652/2012, 1356/2012, 446/2020
  // ══════════════════════════════════════════════════════════

  // ── Tabla "cocolab_actas" (cabecera) ──────────────────────
  cocolabActasTableId: process.env.COCOLAB_ACTAS_TABLE_ID!,
  cocolabActasFields: {
    ID:                        process.env.COCOLAB_ACTAS_ID_FIELD!,
    NUMERO_ACTA:               process.env.COCOLAB_ACTAS_NUMERO_ACTA_FIELD!,
    MES_EVALUADO:              process.env.COCOLAB_ACTAS_MES_EVALUADO_FIELD!,
    FECHA_REUNION:             process.env.COCOLAB_ACTAS_FECHA_REUNION_FIELD!,
    HORA_INICIO:               process.env.COCOLAB_ACTAS_HORA_INICIO_FIELD!,
    HORA_CIERRE:               process.env.COCOLAB_ACTAS_HORA_CIERRE_FIELD!,
    LUGAR:                     process.env.COCOLAB_ACTAS_LUGAR_FIELD!,
    QUEJAS_ACOSO:              process.env.COCOLAB_ACTAS_QUEJAS_ACOSO_FIELD!,
    QUEJAS_ACOSO_DETALLE:      process.env.COCOLAB_ACTAS_QUEJAS_DETALLE_FIELD!,
    CONFLICTOS_LABORALES:      process.env.COCOLAB_ACTAS_CONFLICTOS_FIELD!,
    CONFLICTOS_DETALLE:        process.env.COCOLAB_ACTAS_CONFLICTOS_DETALLE_FIELD!,
    ESTADO:                    process.env.COCOLAB_ACTAS_ESTADO_FIELD!,
    FIRMA_PRESIDENTE:          process.env.COCOLAB_ACTAS_FIRMA_PRESIDENTE_FIELD!,
    FIRMA_SECRETARIA:          process.env.COCOLAB_ACTAS_FIRMA_SECRETARIA_FIELD!,
    URL_DOCUMENTO:             process.env.COCOLAB_ACTAS_URL_DOCUMENTO_FIELD!,
    FECHA_EXPORTACION:         process.env.COCOLAB_ACTAS_FECHA_EXPORT_FIELD!,
    ASISTENTES_LINK:           process.env.COCOLAB_ACTAS_ASISTENTES_LINK_FIELD!,    // → Miembros Comite SST
    ACCIONES_LINK:             process.env.COCOLAB_ACTAS_ACCIONES_LINK_FIELD!,     // → cocolab_acciones_preventivas
    COMPROMISOS_LINK:          process.env.COCOLAB_ACTAS_COMPROMISOS_LINK_FIELD!,  // → compromisos (compartida)
    CREATED_AT:                process.env.COCOLAB_ACTAS_CREATED_AT_FIELD!,
    UPDATED_AT:                process.env.COCOLAB_ACTAS_UPDATED_AT_FIELD!,
  },

  // ── Tabla "cocolab_acciones_preventivas" ──────────────────
  cocolabAccionesTableId: process.env.COCOLAB_ACCIONES_TABLE_ID!,
  cocolabAccionesFields: {
    ID:           process.env.COCOLAB_ACCIONES_ID_FIELD!,
    ACTA_LINK:    process.env.COCOLAB_ACCIONES_ACTA_LINK_FIELD!,
    CATEGORIA:    process.env.COCOLAB_ACCIONES_CATEGORIA_FIELD!,
    DESCRIPCION:  process.env.COCOLAB_ACCIONES_DESCRIPCION_FIELD!,
  },

  // ══════════════════════════════════════════════════════════
  // Tabla "compromisos" — COMPARTIDA entre COPASST y COCOLAB
  // (discriminador: campo COMITE)
  // ══════════════════════════════════════════════════════════
  compromisosTableId: process.env.COMPROMISOS_TABLE_ID!,
  compromisosFields: {
    ID:                process.env.COMPROMISOS_ID_FIELD!,
    COMITE:            process.env.COMPROMISOS_COMITE_FIELD!,             // COPASST|COCOLAB
    ACTA_COPASST_LINK: process.env.COMPROMISOS_ACTA_COPASST_LINK_FIELD!,
    ACTA_COCOLAB_LINK: process.env.COMPROMISOS_ACTA_COCOLAB_LINK_FIELD!,
    COMPROMISO:        process.env.COMPROMISOS_DESCRIPCION_FIELD!,
    RESPONSABLE:       process.env.COMPROMISOS_RESPONSABLE_FIELD!,
    FECHA_LIMITE:      process.env.COMPROMISOS_FECHA_LIMITE_FIELD!,
    CUMPLIDO:          process.env.COMPROMISOS_CUMPLIDO_FIELD!,
  },

  // ══════════════════════════════════════════════════════════
  // Tabla EXISTENTE "Miembros Comite SST" (tbl6bA8ZA7WVOckHI)
  // REUTILIZADA: NO crear duplicados. Filtrar por campo COMITE.
  // ══════════════════════════════════════════════════════════
  miembrosComiteTableId: process.env.MIEMBROS_COMITE_TABLE_ID!,
  miembrosComiteFields: {
    ID:                process.env.MIEMBROS_COMITE_ID_FIELD!,            // ID Miembro (primary)
    NOMBRE:            process.env.MIEMBROS_COMITE_NOMBRE_FIELD!,
    CEDULA:            process.env.MIEMBROS_COMITE_CEDULA_FIELD!,
    CARGO:             process.env.MIEMBROS_COMITE_CARGO_FIELD!,
    COMITE:            process.env.MIEMBROS_COMITE_COMITE_FIELD!,        // singleSelect: COPASST|COCOLAB
    ROL:               process.env.MIEMBROS_COMITE_ROL_FIELD!,
    ESTADO:            process.env.MIEMBROS_COMITE_ESTADO_FIELD!,
    ID_EMPLEADO_CORE:  process.env.MIEMBROS_COMITE_EMPLEADO_CORE_FIELD || "",
    REPRESENTACION:    process.env.MIEMBROS_COMITE_REPRESENTACION_FIELD || "",
    FECHA_INICIO:      process.env.MIEMBROS_COMITE_FECHA_INICIO_FIELD || "",
    FECHA_FIN:         process.env.MIEMBROS_COMITE_FECHA_FIN_FIELD || "",
  },

  // ══════════════════════════════════════════════════════════
  // Tabla "asistencia_comites" — Tabla intermedia para asistencia + firma
  // Compartida entre COPASST y COCOLAB (discriminador: campo COMITE)
  // Reemplaza el uso directo de ASISTENTES_LINK en actas
  // ══════════════════════════════════════════════════════════
  asistenciaComitesTableId: process.env.ASISTENCIA_COMITES_TABLE_ID!,
  asistenciaComitesFields: {
    ID_ASISTENCIA:          process.env.ASISTENCIA_COMITES_ID_FIELD!,
    ACTA_COPASST_LINK:      process.env.ASISTENCIA_COMITES_ACTA_COPASST_LINK_FIELD!,
    ACTA_COCOLAB_LINK:      process.env.ASISTENCIA_COMITES_ACTA_COCOLAB_LINK_FIELD!,
    MIEMBRO_LINK:           process.env.ASISTENCIA_COMITES_MIEMBRO_LINK_FIELD!,
    COMITE:                 process.env.ASISTENCIA_COMITES_COMITE_FIELD!,        // COPASST|COCOLAB
    ASISTIO:                process.env.ASISTENCIA_COMITES_ASISTIO_FIELD!,       // checkbox
    FIRMA:                  process.env.ASISTENCIA_COMITES_FIRMA_FIELD!,         // longText: data URL
    FECHA_FIRMA:            process.env.ASISTENCIA_COMITES_FECHA_FIRMA_FIELD!,   // dateTime
    OBSERVACIONES:          process.env.ASISTENCIA_COMITES_OBSERVACIONES_FIELD || "",
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
