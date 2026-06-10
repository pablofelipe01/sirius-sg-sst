// ══════════════════════════════════════════════════════════
// Configuración Airtable — Módulo Inducciones & Reinducciones
// Base "Sirius SG-SST"
// Tablas: ind_registros, ind_tokens_firma, ind_alertas_log
// ══════════════════════════════════════════════════════════

export const airtableInduccionesConfig = {
  apiToken: process.env.AIRTABLE_SGSST_API_TOKEN!,
  baseId: process.env.AIRTABLE_SGSST_BASE_ID!,
  baseUrl: "https://api.airtable.com/v0",

  // ── Tabla "ind_registros" — Registro maestro ────────────
  registrosTableId: process.env.AIRTABLE_IND_REGISTROS_TABLE_ID!,
  registrosFields: {
    ID_INDUCCION: process.env.AIRTABLE_IND_REG_ID_INDUCCION!,
    ID_EMPLEADO_CORE: process.env.AIRTABLE_IND_REG_ID_EMPLEADO_CORE!,
    NOMBRE_EMPLEADO: process.env.AIRTABLE_IND_REG_NOMBRE_EMPLEADO!,
    NUMERO_DOCUMENTO: process.env.AIRTABLE_IND_REG_NUMERO_DOCUMENTO!,
    CARGO: process.env.AIRTABLE_IND_REG_CARGO!,
    TIPO: process.env.AIRTABLE_IND_REG_TIPO!,
    FECHA_REALIZACION: process.env.AIRTABLE_IND_REG_FECHA_REALIZACION!,
    FECHA_VENCIMIENTO: process.env.AIRTABLE_IND_REG_FECHA_VENCIMIENTO!,
    RESPONSABLE_SST: process.env.AIRTABLE_IND_REG_RESPONSABLE_SST!,
    EVALUACION_ID: process.env.AIRTABLE_IND_REG_EVALUACION_ID!,
    PUNTAJE_EVALUACION: process.env.AIRTABLE_IND_REG_PUNTAJE_EVALUACION!,
    ESTADO_EVALUACION: process.env.AIRTABLE_IND_REG_ESTADO_EVALUACION!,
    FIRMA_URL: process.env.AIRTABLE_IND_REG_FIRMA_URL!,
    CERTIFICADO_URL: process.env.AIRTABLE_IND_REG_CERTIFICADO_URL!,
    FECHA_EXPORTACION: process.env.AIRTABLE_IND_REG_FECHA_EXPORTACION!,
    ESTADO: process.env.AIRTABLE_IND_REG_ESTADO!,
    OBSERVACIONES: process.env.AIRTABLE_IND_REG_OBSERVACIONES!,
    TOKENS_LINK: process.env.AIRTABLE_IND_REG_LINK_TOKENS!,
    ALERTAS_LINK: process.env.AIRTABLE_IND_REG_LINK_ALERTAS!,
  },

  // ── Tabla "ind_tokens_firma" — Tokens firma digital ─────
  tokensTableId: process.env.AIRTABLE_IND_TOKENS_FIRMA_TABLE_ID!,
  tokensFields: {
    TOKEN_ID: process.env.AIRTABLE_IND_TKN_TOKEN_ID!,
    INDUCCION_ID: process.env.AIRTABLE_IND_TKN_INDUCCION_ID!,
    ID_EMPLEADO_CORE: process.env.AIRTABLE_IND_TKN_ID_EMPLEADO_CORE!,
    HASH_FIRMA: process.env.AIRTABLE_IND_TKN_HASH_FIRMA!,
    FECHA_GENERACION: process.env.AIRTABLE_IND_TKN_FECHA_GENERACION!,
    FECHA_EXPIRACION: process.env.AIRTABLE_IND_TKN_FECHA_EXPIRACION!,
    ESTADO_TOKEN: process.env.AIRTABLE_IND_TKN_ESTADO_TOKEN!,
    REGISTROS_LINK: process.env.AIRTABLE_IND_TKN_LINK_REGISTROS!,
  },

  // ── Tabla "ind_alertas_log" — Log de alertas ────────────
  alertasTableId: process.env.AIRTABLE_IND_ALERTAS_LOG_TABLE_ID!,
  alertasFields: {
    ID_ALERTA: process.env.AIRTABLE_IND_ALR_ID_ALERTA!,
    INDUCCION_ID: process.env.AIRTABLE_IND_ALR_INDUCCION_ID!,
    ID_EMPLEADO_CORE: process.env.AIRTABLE_IND_ALR_ID_EMPLEADO_CORE!,
    NOMBRE_EMPLEADO: process.env.AIRTABLE_IND_ALR_NOMBRE_EMPLEADO!,
    FECHA_VENCIMIENTO: process.env.AIRTABLE_IND_ALR_FECHA_VENCIMIENTO!,
    FECHA_ALERTA: process.env.AIRTABLE_IND_ALR_FECHA_ALERTA!,
    TIPO_ALERTA: process.env.AIRTABLE_IND_ALR_TIPO_ALERTA!,
    ENVIADA: process.env.AIRTABLE_IND_ALR_ENVIADA!,
    FECHA_ENVIO: process.env.AIRTABLE_IND_ALR_FECHA_ENVIO!,
    CORREO_DESTINO: process.env.AIRTABLE_IND_ALR_CORREO_DESTINO!,
    OBSERVACIONES_ENVIO: process.env.AIRTABLE_IND_ALR_OBSERVACIONES_ENVIO!,
  },

  // ── Tabla "Constancias_Inducciones" — Datos de constancia ─
  constanciasTableId: process.env.AIRTABLE_IND_CONSTANCIAS_TABLE_ID!,
  constanciasFields: {
    ID_CONSTANCIA: process.env.AIRTABLE_IND_CONST_ID_CONSTANCIA!,
    ID_INDUCCION: process.env.AIRTABLE_IND_CONST_ID_INDUCCION!,
    FECHA_REALIZACION: process.env.AIRTABLE_IND_CONST_FECHA_REALIZACION!,
    LUGAR_REALIZACION: process.env.AIRTABLE_IND_CONST_LUGAR_REALIZACION!,
    HORA_INICIO: process.env.AIRTABLE_IND_CONST_HORA_INICIO!,
    HORA_FIN: process.env.AIRTABLE_IND_CONST_HORA_FIN!,
    RESPONSABLE_SST: process.env.AIRTABLE_IND_CONST_RESPONSABLE_SST!,
    OBSERVACIONES: process.env.AIRTABLE_IND_CONST_OBSERVACIONES!,
  },
};

// ── Helper: Crear cliente Airtable ──────────────────────────
export function createInduccionesClient() {
  const { apiToken, baseId, baseUrl } = airtableInduccionesConfig;

  return {
    baseUrl: `${baseUrl}/${baseId}`,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
  };
}

// ── Configuración del módulo ────────────────────────────────
export const induccionesModuleConfig = {
  alertaDiasAnticipacion: parseInt(process.env.IND_ALERTA_DIAS_ANTICIPACION || "15", 10),
  vigenciaMeses: parseInt(process.env.IND_VIGENCIA_MESES || "12", 10),
  tokenExpiracionHoras: parseInt(process.env.IND_TOKEN_EXPIRACION_HORAS || "24", 10),
  correoSST: process.env.IND_CORREO_SST || "",

  // Prefijos S3
  s3PrefixFirmas: process.env.IND_S3_PREFIX_FIRMAS || "inducciones-firmas",
  s3PrefixCertificados: process.env.IND_S3_PREFIX_CERTIFICADOS || "inducciones-certificados",

  // Código de la plantilla de evaluación fija
  plantillaEvaluacionCodigo: process.env.IND_PLANTILLA_EVALUACION_CODIGO || "PLNT-IND-2026",
};

// ── Tipos de datos ──────────────────────────────────────────
export type TipoInduccion = "Induccion" | "Reinduccion";
export type EstadoInduccion = "En_Proceso" | "Pendiente_Firma" | "Completada";
export type EstadoEvaluacion = "Aprobada" | "Pendiente" | "No_Presentada";
export type EstadoToken = "Pendiente" | "Usado" | "Expirado";
export type TipoAlerta = "15_DIAS";

// ── Los 3 módulos temáticos (hardcodeados) ─────────────────
export const modulosInduccion = {
  administrativa: {
    nombre: "Administrativa",
    temas: [
      "Veeduría administrativa",
      "Reglamento interno de trabajo",
      "Afiliación al sistema de seguridad social",
      "Protocolo sobre actividades agrícolas",
      "Socialización del procedimiento de PQR",
      "Deberes y derechos de los trabajadores",
    ],
  },
  sst: {
    nombre: "Seguridad y Salud en el Trabajo",
    temas: [
      "Reglamento de higiene",
      "Descripción del SG-SST",
      "EPP — Elementos de Protección Personal",
      "Política de alcohol y drogas",
      "Política de seguridad vial",
      "Política ambiental",
      "Política de acoso laboral",
      "Política de EPP",
      "Matriz IPVR — Identificación de Peligros y Valoración de Riesgos",
      "Identificación y clasificación de riesgos",
      "COPASST — Comité Paritario de SST",
      "Riesgos por manipulación de herramientas",
      "Plan de emergencia",
      "Brigada de emergencia",
      "Procedimiento ante accidente de trabajo",
      "Programa de reporte de condiciones inseguras",
    ],
  },
  medioAmbiente: {
    nombre: "Medio Ambiente",
    temas: [
      "Aspectos e impactos ambientales",
      "Atención y control de derrames",
      "Reporte de incendios forestales",
      "Separación en la fuente de residuos",
    ],
  },
};
