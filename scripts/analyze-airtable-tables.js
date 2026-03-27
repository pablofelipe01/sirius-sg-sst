/**
 * Script para analizar las tablas de Airtable y detectar cuáles están vacías
 * Ejecutar con: node scripts/analyze-airtable-tables.js
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = "https://api.airtable.com/v0";

// Configuración de las 3 bases de datos
const BASES = {
  "SG-SST": {
    baseId: process.env.AIRTABLE_SGSST_BASE_ID,
    token: process.env.AIRTABLE_SGSST_API_TOKEN,
    tables: {
      "Entregas EPP": process.env.AIRTABLE_ENTREGAS_TABLE_ID,
      "Detalle Entrega EPP": process.env.AIRTABLE_DETALLE_TABLE_ID,
      "Tokens Entrega": process.env.AIRTABLE_TOKENS_TABLE_ID,
      "Historial EPP Empleado": process.env.AIRTABLE_HIST_TABLE_ID,
      "Inspecciones EPP": process.env.AIRTABLE_INSP_TABLE_ID,
      "Detalle Inspección EPP": process.env.AIRTABLE_DETINSP_TABLE_ID,
      "Equipos Emergencia": process.env.AIRTABLE_EQUIP_TABLE_ID,
      "Inspecciones Equipos Emergencia": process.env.AIRTABLE_INSPEQ_TABLE_ID,
      "Detalle Inspección Equipos": process.env.AIRTABLE_DETEQ_TABLE_ID,
      "Responsables Inspección Equipos": process.env.AIRTABLE_RESPEQ_TABLE_ID,
      "Capacitaciones": process.env.AIRTABLE_CAP_TABLE_ID,
      "Programación Capacitaciones": process.env.AIRTABLE_PROG_TABLE_ID,
      "Eventos Capacitación": process.env.AIRTABLE_EVT_TABLE_ID,
      "Asistencia Capacitaciones": process.env.AIRTABLE_ASIS_TABLE_ID,
      "Banco de Preguntas": process.env.AIRTABLE_PRG_BANCO_TABLE_ID,
      "Plantillas Evaluación": process.env.AIRTABLE_PLNT_TABLE_ID,
      "Preguntas por Plantilla": process.env.AIRTABLE_PXPL_TABLE_ID,
      "Evaluaciones Aplicadas": process.env.AIRTABLE_EVALAP_TABLE_ID,
      "Respuestas Evaluación": process.env.AIRTABLE_RESP_TABLE_ID,
      "Miembros Comités SST": process.env.AIRTABLE_MBR_TABLE_ID,
      "Inspecciones Áreas": process.env.AIRTABLE_INSPA_TABLE_ID,
      "Detalle Inspección Áreas": process.env.AIRTABLE_DETINSPA_TABLE_ID,
      "Responsables Inspección Áreas": process.env.AIRTABLE_RESPINSPA_TABLE_ID,
      "Acciones Correctivas Áreas": process.env.AIRTABLE_ACCINSPA_TABLE_ID,
      "Inspecciones Botiquín": process.env.AIRTABLE_INSPBOT_TABLE_ID,
      "Detalle Inspección Botiquín": process.env.AIRTABLE_DETBOT_TABLE_ID,
      "Responsables Inspección Botiquín": process.env.AIRTABLE_RESPBOT_TABLE_ID,
      "Botiquines (Catálogo)": process.env.AIRTABLE_BOTIQUINES_TABLE_ID,
      "Catálogo Elementos Botiquín": process.env.AIRTABLE_ELEMBOT_TABLE_ID,
      "Inspecciones Extintor": process.env.AIRTABLE_INSPEXT_TABLE_ID,
      "Detalle Inspección Extintor": process.env.AIRTABLE_DETEXT_TABLE_ID,
      "Responsables Inspección Extintor": process.env.AIRTABLE_RESPEXT_TABLE_ID,
      "Extintores (Catálogo)": process.env.AIRTABLE_EXTINTORES_TABLE_ID,
      "Inspecciones Camilla": process.env.AIRTABLE_INSPCAM_TABLE_ID,
      "Detalle Inspección Camilla": process.env.AIRTABLE_DETCAM_TABLE_ID,
      "Responsables Inspección Camilla": process.env.AIRTABLE_RESPCAM_TABLE_ID,
      "Camillas (Catálogo)": process.env.AIRTABLE_CAMILLAS_TABLE_ID,
      "Catálogo Elementos Camilla": process.env.AIRTABLE_ELEMCAM_TABLE_ID,
      "Inspecciones Kit Derrames": process.env.AIRTABLE_INSPKIT_TABLE_ID,
      "Detalle Inspección Kit Derrames": process.env.AIRTABLE_DETKIT_TABLE_ID,
      "Verificaciones Kit Derrames": process.env.AIRTABLE_VERKIT_TABLE_ID,
      "Responsables Inspección Kit Derrames": process.env.AIRTABLE_RESPKIT_TABLE_ID,
      "Kits Control Derrames (Catálogo)": process.env.AIRTABLE_KITS_TABLE_ID,
      "Catálogo Elementos Kit Derrames": process.env.AIRTABLE_ELEMKIT_TABLE_ID,
    }
  },
  "Personal": {
    baseId: process.env.AIRTABLE_BASE_ID,
    token: process.env.AIRTABLE_API_TOKEN,
    tables: {
      "Personal": process.env.AIRTABLE_PERSONAL_TABLE_ID,
      "Sistemas": process.env.AIRTABLE_SISTEMAS_TABLE_ID,
    }
  },
  "Insumos SST": {
    baseId: process.env.AIRTABLE_INSUMOS_BASE_ID,
    token: process.env.AIRTABLE_INSUMOS_API_TOKEN,
    tables: {
      "Insumo (Catálogo)": process.env.AIRTABLE_INSUMO_TABLE_ID,
      "Stock Insumo": process.env.AIRTABLE_STOCK_INSUMO_TABLE_ID,
      "Movimientos Insumo": process.env.AIRTABLE_MOV_INSUMO_TABLE_ID,
    }
  }
};

async function getRecordCount(baseId, tableId, token) {
  if (!baseId || !tableId || !token) {
    return { count: -1, error: "Config faltante" };
  }

  const url = `${BASE_URL}/${baseId}/${tableId}?pageSize=100`;
  
  try {
    let totalRecords = 0;
    let offset = null;
    
    do {
      const fetchUrl = offset ? `${url}&offset=${offset}` : url;
      const response = await fetch(fetchUrl, {
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        return { count: -1, error: `HTTP ${response.status}: ${errorText.substring(0, 100)}` };
      }

      const data = await response.json();
      totalRecords += data.records?.length || 0;
      offset = data.offset;
      
    } while (offset);

    return { count: totalRecords, error: null };
  } catch (error) {
    return { count: -1, error: error.message };
  }
}

async function analyzeAllTables() {
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("           ANÁLISIS DE TABLAS AIRTABLE - SIRIUS SG-SST");
  console.log("═══════════════════════════════════════════════════════════════\n");

  const results = {
    empty: [],
    withData: [],
    errors: [],
    noConfig: []
  };

  for (const [baseName, baseConfig] of Object.entries(BASES)) {
    console.log(`\n📁 BASE: ${baseName}`);
    console.log("─".repeat(60));

    if (!baseConfig.baseId) {
      console.log(`   ⚠️  Base ID no configurado`);
      continue;
    }

    for (const [tableName, tableId] of Object.entries(baseConfig.tables)) {
      if (!tableId) {
        results.noConfig.push({ base: baseName, table: tableName });
        console.log(`   ❌ ${tableName}: TABLE_ID no configurado`);
        continue;
      }

      const { count, error } = await getRecordCount(
        baseConfig.baseId, 
        tableId, 
        baseConfig.token
      );

      if (error) {
        results.errors.push({ base: baseName, table: tableName, error });
        console.log(`   ⚠️  ${tableName}: ERROR - ${error}`);
      } else if (count === 0) {
        results.empty.push({ base: baseName, table: tableName });
        console.log(`   🔴 ${tableName}: VACÍA (0 registros)`);
      } else {
        results.withData.push({ base: baseName, table: tableName, count });
        console.log(`   ✅ ${tableName}: ${count} registros`);
      }

      // Pequeña pausa para no saturar la API
      await new Promise(resolve => setTimeout(resolve, 200));
    }
  }

  // Resumen
  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("                           RESUMEN");
  console.log("═══════════════════════════════════════════════════════════════\n");

  console.log(`📊 TABLAS CON DATOS: ${results.withData.length}`);
  results.withData.forEach(t => console.log(`   ✅ [${t.base}] ${t.table}: ${t.count} registros`));

  console.log(`\n🔴 TABLAS VACÍAS: ${results.empty.length}`);
  results.empty.forEach(t => console.log(`   🔴 [${t.base}] ${t.table}`));

  console.log(`\n❌ TABLAS SIN CONFIGURAR: ${results.noConfig.length}`);
  results.noConfig.forEach(t => console.log(`   ❌ [${t.base}] ${t.table}`));

  console.log(`\n⚠️  ERRORES: ${results.errors.length}`);
  results.errors.forEach(t => console.log(`   ⚠️  [${t.base}] ${t.table}: ${t.error}`));

  console.log("\n═══════════════════════════════════════════════════════════════\n");
}

analyzeAllTables().catch(console.error);
