/**
 * Diagnóstico: Acciones Correctivas en Inspecciones de Áreas
 * Verifica la integridad de los datos en Airtable
 * 
 * Ejecutar: node scripts/diagnostico-acciones-areas.js
 */

require('dotenv').config({ path: '.env.local' });

const BASE_URL = "https://api.airtable.com/v0";
const BASE_ID = process.env.AIRTABLE_SGSST_BASE_ID;
const TOKEN = process.env.AIRTABLE_SGSST_API_TOKEN;

// Table IDs
const INSPECCIONES_TABLE = process.env.AIRTABLE_INSPA_TABLE_ID;
const ACCIONES_TABLE = process.env.AIRTABLE_ACCINSPA_TABLE_ID;
const DETALLE_TABLE = process.env.AIRTABLE_DETINSPA_TABLE_ID;

// Field IDs
const F = {
  // Inspecciones Áreas (cabecera)
  INSPA_ID: process.env.AIRTABLE_INSPA_ID,
  INSPA_FECHA: process.env.AIRTABLE_INSPA_FECHA,
  INSPA_AREA: process.env.AIRTABLE_INSPA_AREA,
  INSPA_ESTADO: process.env.AIRTABLE_INSPA_ESTADO,
  INSPA_ACCIONES_LINK: process.env.AIRTABLE_INSPA_ACCIONES_LINK,
  // Acciones Correctivas
  ACC_ID: process.env.AIRTABLE_ACCINSPA_ID,
  ACC_INSPECCION_LINK: process.env.AIRTABLE_ACCINSPA_INSPECCION_LINK,
  ACC_DESCRIPCION: process.env.AIRTABLE_ACCINSPA_DESCRIPCION,
  ACC_TIPO: process.env.AIRTABLE_ACCINSPA_TIPO,
  ACC_RESPONSABLE: process.env.AIRTABLE_ACCINSPA_RESPONSABLE,
  ACC_ESTADO: process.env.AIRTABLE_ACCINSPA_ESTADO,
  ACC_FECHA_PROPUESTA: process.env.AIRTABLE_ACCINSPA_FECHA_PROPUESTA,
};

const headers = {
  Authorization: `Bearer ${TOKEN}`,
  "Content-Type": "application/json",
};

async function fetchAllRecords(tableId, extraParams = "") {
  const all = [];
  let offset = "";
  do {
    const url = `${BASE_URL}/${BASE_ID}/${tableId}?returnFieldsByFieldId=true&pageSize=100${offset ? `&offset=${offset}` : ""}${extraParams ? `&${extraParams}` : ""}`;
    const res = await fetch(url, { headers });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Airtable error ${res.status}: ${text}`);
    }
    const data = await res.json();
    all.push(...data.records);
    offset = data.offset || "";
  } while (offset);
  return all;
}

function sep(title) {
  console.log(`\n${"═".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"═".repeat(60)}`);
}

async function main() {
  // Validar config
  const missing = Object.entries(F).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length > 0) {
    console.error("❌ Variables de entorno faltantes:", missing.join(", "));
    process.exit(1);
  }
  if (!BASE_ID || !TOKEN) {
    console.error("❌ Falta AIRTABLE_SGSST_BASE_ID o AIRTABLE_SGSST_API_TOKEN");
    process.exit(1);
  }

  sep("1. INSPECCIONES DE ÁREAS (cabecera)");
  const inspecciones = await fetchAllRecords(INSPECCIONES_TABLE);
  console.log(`Total inspecciones: ${inspecciones.length}`);

  // Mostrar resumen por estado
  const porEstado = {};
  inspecciones.forEach((r) => {
    const est = r.fields[F.INSPA_ESTADO] || "(vacío)";
    porEstado[est] = (porEstado[est] || 0) + 1;
  });
  console.log("Por estado:", porEstado);

  // Verificar campo ACCIONES_LINK en cada inspección
  let conAccionesLink = 0;
  let sinAccionesLink = 0;
  inspecciones.forEach((r) => {
    const links = r.fields[F.INSPA_ACCIONES_LINK];
    if (links && Array.isArray(links) && links.length > 0) {
      conAccionesLink++;
    } else {
      sinAccionesLink++;
    }
  });
  console.log(`Con ACCIONES_LINK poblado: ${conAccionesLink}`);
  console.log(`Sin ACCIONES_LINK (vacío): ${sinAccionesLink}`);

  sep("2. ACCIONES CORRECTIVAS ÁREAS");
  const acciones = await fetchAllRecords(ACCIONES_TABLE);
  console.log(`Total acciones correctivas: ${acciones.length}`);

  if (acciones.length === 0) {
    console.log("\n⚠️  NO HAY ACCIONES CORRECTIVAS EN LA TABLA.");
    console.log("   Esto explica por qué los reportes salen vacíos.");
    console.log("   Verificar si el formulario de inspección incluye acciones.");
  } else {
    // Verificar INSPECCION_LINK
    let conLink = 0;
    let sinLink = 0;
    let linkRoto = 0;
    const inspRecordIds = new Set(inspecciones.map((r) => r.id));

    acciones.forEach((r) => {
      const links = r.fields[F.ACC_INSPECCION_LINK];
      if (!links || !Array.isArray(links) || links.length === 0) {
        sinLink++;
      } else {
        conLink++;
        // Verificar que el link apunte a una inspección existente
        links.forEach((linkId) => {
          if (!inspRecordIds.has(linkId)) linkRoto++;
        });
      }
    });

    console.log(`Con INSPECCION_LINK: ${conLink}`);
    console.log(`Sin INSPECCION_LINK: ${sinLink}`);
    console.log(`Links rotos (apuntan a inspección inexistente): ${linkRoto}`);

    // Detalle de cada acción
    sep("3. DETALLE DE CADA ACCIÓN");
    acciones.forEach((r, idx) => {
      const id = r.fields[F.ACC_ID] || "(sin ID)";
      const desc = r.fields[F.ACC_DESCRIPCION] || "(sin descripción)";
      const tipo = r.fields[F.ACC_TIPO] || "(sin tipo)";
      const resp = r.fields[F.ACC_RESPONSABLE] || "(sin responsable)";
      const estado = r.fields[F.ACC_ESTADO] || "(sin estado)";
      const fecha = r.fields[F.ACC_FECHA_PROPUESTA] || "(sin fecha)";
      const links = r.fields[F.ACC_INSPECCION_LINK] || [];

      console.log(`\n  [${idx + 1}] ${id}`);
      console.log(`      Record ID: ${r.id}`);
      console.log(`      Descripción: ${desc}`);
      console.log(`      Tipo: ${tipo} | Estado: ${estado}`);
      console.log(`      Responsable: ${resp}`);
      console.log(`      Fecha propuesta: ${fecha}`);
      console.log(`      INSPECCION_LINK: ${JSON.stringify(links)}`);

      if (links.length > 0) {
        const insp = inspecciones.find((i) => i.id === links[0]);
        if (insp) {
          console.log(`      → Inspección: ${insp.fields[F.INSPA_ID]} | Área: ${insp.fields[F.INSPA_AREA]} | Fecha: ${insp.fields[F.INSPA_FECHA]}`);
        } else {
          console.log(`      ⚠️  Link roto: no existe inspección con record ID ${links[0]}`);
        }
      }
    });
  }

  // Cruce: inspecciones que deberían tener acciones vs las que tienen
  sep("4. CRUCE: Inspecciones ↔ Acciones");
  
  // Construir mapa: inspRecordId → acciones[]
  const accionesPorInsp = {};
  acciones.forEach((r) => {
    const links = r.fields[F.ACC_INSPECCION_LINK] || [];
    links.forEach((inspId) => {
      if (!accionesPorInsp[inspId]) accionesPorInsp[inspId] = [];
      accionesPorInsp[inspId].push(r);
    });
  });

  console.log("\nInspecciones con acciones vinculadas por INSPECCION_LINK:");
  let countConAcciones = 0;
  inspecciones.forEach((insp) => {
    const id = insp.fields[F.INSPA_ID] || insp.id;
    const accionesLink = insp.fields[F.INSPA_ACCIONES_LINK] || [];
    const accionesByLink = accionesPorInsp[insp.id] || [];
    
    if (accionesLink.length > 0 || accionesByLink.length > 0) {
      countConAcciones++;
      console.log(`  ${id} | Área: ${insp.fields[F.INSPA_AREA]} | Fecha: ${insp.fields[F.INSPA_FECHA]}`);
      console.log(`    ACCIONES_LINK (cabecera → acciones): ${accionesLink.length} record IDs`);
      console.log(`    INSPECCION_LINK (acciones → cabecera): ${accionesByLink.length} registros`);
      
      if (accionesLink.length !== accionesByLink.length) {
        console.log(`    ⚠️  INCONSISTENCIA: ACCIONES_LINK tiene ${accionesLink.length} pero hay ${accionesByLink.length} acciones apuntando a esta inspección`);
      }
    }
  });

  if (countConAcciones === 0) {
    console.log("  (Ninguna inspección tiene acciones correctivas vinculadas)");
  }

  // Simular lo que haría el export Excel/PDF
  sep("5. SIMULACIÓN EXPORT (accionesMap[r.id])");
  console.log("Simulando la lógica de exportar/route.ts y exportar-pdf/route.ts:");
  console.log("accionesMap se construye con: INSPECCION_LINK → inspRecordId\n");
  
  inspecciones.forEach((insp) => {
    const id = insp.fields[F.INSPA_ID] || "(sin ID)";
    const matched = accionesPorInsp[insp.id] || [];
    if (matched.length > 0) {
      console.log(`  ✅ ${id} → ${matched.length} acciones encontradas por export`);
    }
  });

  const inspSinMatch = inspecciones.filter((i) => !(accionesPorInsp[i.id] || []).length);
  console.log(`\n  Inspecciones sin acciones en export: ${inspSinMatch.length} de ${inspecciones.length}`);

  sep("RESUMEN");
  console.log(`Inspecciones totales: ${inspecciones.length}`);
  console.log(`Acciones correctivas totales: ${acciones.length}`);
  console.log(`Inspecciones con acciones (por INSPECCION_LINK): ${countConAcciones}`);
  console.log(`Inspecciones sin acciones: ${inspecciones.length - countConAcciones}`);

  if (acciones.length === 0) {
    console.log("\n🔴 DIAGNÓSTICO: La tabla de acciones está VACÍA.");
    console.log("   Las acciones nunca se guardaron o se eliminaron.");
  } else if (acciones.every((a) => !(a.fields[F.ACC_INSPECCION_LINK] || []).length)) {
    console.log("\n🔴 DIAGNÓSTICO: Las acciones existen pero NINGUNA tiene INSPECCION_LINK.");
    console.log("   El campo de enlace no se pobló al crear las acciones.");
  } else {
    console.log("\n🟢 Los datos parecen correctos. Si el problema persiste,");
    console.log("   verificar que la inspección específica tenga acciones asociadas.");
  }
}

main().catch((err) => {
  console.error("Error ejecutando diagnóstico:", err);
  process.exit(1);
});
