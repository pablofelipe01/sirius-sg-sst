// ══════════════════════════════════════════════════════════
// Configuración Airtable — Base "Sirius Insumos Core"
// Base maestra de inventario de la empresa
// ══════════════════════════════════════════════════════════

export const airtableInsumosConfig = {
  apiToken: process.env.AIRTABLE_INSUMOS_API_TOKEN!,
  baseId: process.env.AIRTABLE_INSUMOS_BASE_ID!,
  baseUrl: "https://api.airtable.com/v0",

  // ── Tabla "Insumo" ────────────────────────────────────
  insumoTableId: process.env.AIRTABLE_INSUMO_TABLE_ID!,
  insumoFields: {
    CODIGO: process.env.AIRTABLE_INS_CODIGO!,
    ID: process.env.AIRTABLE_INS_ID!,
    NOMBRE: process.env.AIRTABLE_INS_NOMBRE!,
    UNIDAD_MEDIDA: process.env.AIRTABLE_INS_UNIDAD_MEDIDA!,
    STOCK_MINIMO: process.env.AIRTABLE_INS_STOCK_MINIMO!,
    ESTADO: process.env.AIRTABLE_INS_ESTADO!,
    IMAGEN: process.env.AIRTABLE_INS_IMAGEN!,
    REFERENCIA_COMERCIAL: process.env.AIRTABLE_INS_REFERENCIA_COMERCIAL!,
    RESPONSABLE: process.env.AIRTABLE_INS_RESPONSABLE!,
    CATEGORIA: process.env.AIRTABLE_INS_CATEGORIA!,
    MOVIMIENTOS: process.env.AIRTABLE_INS_MOVIMIENTOS!,
  },

  // ── Tabla "Categoria Insumo" ──────────────────────────
  categoriaTableId: process.env.AIRTABLE_CAT_INSUMO_TABLE_ID!,
  categoriaFields: {
    CODIGO: process.env.AIRTABLE_CAT_CODIGO!,
    ID: process.env.AIRTABLE_CAT_ID!,
    TIPO: process.env.AIRTABLE_CAT_TIPO!,
    DESCRIPCION: process.env.AIRTABLE_CAT_DESCRIPCION!,
    INSUMO: process.env.AIRTABLE_CAT_INSUMO!,
  },

  // ── Tabla "Movimientos Insumos" ───────────────────────
  movimientosTableId: process.env.AIRTABLE_MOV_INSUMO_TABLE_ID!,
  movimientosFields: {
    CODIGO: process.env.AIRTABLE_MOV_CODIGO!,
    ID: process.env.AIRTABLE_MOV_ID!,
    CREADA: process.env.AIRTABLE_MOV_CREADA!,
    NOMBRE: process.env.AIRTABLE_MOV_NOMBRE!,
    CANTIDAD: process.env.AIRTABLE_MOV_CANTIDAD!,
    TIPO: process.env.AIRTABLE_MOV_TIPO!,
    AREA: process.env.AIRTABLE_MOV_AREA!,
    ID_ORIGEN: process.env.AIRTABLE_MOV_ID_ORIGEN!,
    RESPONSABLE: process.env.AIRTABLE_MOV_RESPONSABLE!,
    INSUMO: process.env.AIRTABLE_MOV_INSUMO!,
  },

  // ── Tabla "Stock Insumos" ─────────────────────────────
  stockTableId: process.env.AIRTABLE_STOCK_INSUMO_TABLE_ID!,

  // ── Record IDs de referencia ──────────────────────────
  eppCategoryRecordId: process.env.AIRTABLE_EPP_CATEGORY_RECORD_ID!,
  dotacionCategoryRecordId: process.env.AIRTABLE_DOTACION_CATEGORY_RECORD_ID!,
};

export function getInsumosUrl(tableId: string): string {
  return `${airtableInsumosConfig.baseUrl}/${airtableInsumosConfig.baseId}/${tableId}`;
}

export function getInsumosHeaders(): HeadersInit {
  return {
    Authorization: `Bearer ${airtableInsumosConfig.apiToken}`,
    "Content-Type": "application/json",
  };
}
