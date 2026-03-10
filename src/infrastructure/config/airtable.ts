export const airtableConfig = {
  apiToken: process.env.AIRTABLE_API_TOKEN!,
  baseId: process.env.AIRTABLE_BASE_ID!,
  personalTableId: process.env.AIRTABLE_PERSONAL_TABLE_ID!,
  sistemasTableId: process.env.AIRTABLE_SISTEMAS_TABLE_ID!,
  rolesTableId: process.env.AIRTABLE_ROLES_TABLE_ID!,
  baseUrl: "https://api.airtable.com/v0",

  // ── Field IDs - Tabla "Personal" ──────────────────────────
  personalFields: {
    ID_EMPLEADO: process.env.AIRTABLE_PF_ID_EMPLEADO!,
    FOTO_PERFIL: process.env.AIRTABLE_PF_FOTO_PERFIL!,
    NOMBRE_COMPLETO: process.env.AIRTABLE_PF_NOMBRE_COMPLETO!,
    TIPO_PERSONAL: process.env.AIRTABLE_PF_TIPO_PERSONAL!,
    ROL: process.env.AIRTABLE_PF_ROL!,
    CORREO: process.env.AIRTABLE_PF_CORREO!,
    TELEFONO: process.env.AIRTABLE_PF_TELEFONO!,
    NUMERO_DOCUMENTO: process.env.AIRTABLE_PF_NUMERO_DOCUMENTO!,
    PASSWORD: process.env.AIRTABLE_PF_PASSWORD!,
    ACCESOS_ASIGNADOS: process.env.AIRTABLE_PF_ACCESOS_ASIGNADOS!,
    ESTADO_ACTIVIDAD: process.env.AIRTABLE_PF_ESTADO_ACTIVIDAD!,
    AREAS: process.env.AIRTABLE_PF_AREAS!,
    ROL_LOOKUP: process.env.AIRTABLE_PF_ROL_LOOKUP!,
  },

  // ── Field IDs - Tabla "Sistemas y Aplicaciones" ───────────
  sistemasFields: {
    NOMBRE_APP: process.env.AIRTABLE_SF_NOMBRE_APP!,
    CODIGO_APP: process.env.AIRTABLE_SF_CODIGO_APP!,
  },

  // ── Field IDs - Tabla "Roles y Permisos" ──────────────────
  rolesFields: {
    NOMBRE_ROL: process.env.AIRTABLE_RF_NOMBRE_ROL!,
  },
};

export function getAirtableUrl(tableId: string): string {
  return `${airtableConfig.baseUrl}/${airtableConfig.baseId}/${tableId}`;
}

export function getAirtableHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${airtableConfig.apiToken}`,
    "Content-Type": "application/json",
  };
}
