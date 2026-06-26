// ══════════════════════════════════════════════════════════
// GET /api/sgsst/vehicular/diagnostico — Verificar configuración
// Endpoint temporal para diagnosticar variables de entorno
// ══════════════════════════════════════════════════════════

import { NextResponse } from "next/server";

export async function GET() {
  const diagnostico = {
    timestamp: new Date().toISOString(),
    estado: "verificando",
    configuracion: {
      airtable: {
        apiToken: process.env.AIRTABLE_SGSST_API_TOKEN ? "✅ Configurado" : "❌ Faltante",
        baseId: process.env.AIRTABLE_SGSST_BASE_ID ? "✅ Configurado" : "❌ Faltante",
      },
      tablas: {
        vehiculos: process.env.AIRTABLE_VEH_VEHICULOS_TABLE_ID ? "✅ Configurado" : "❌ Faltante",
        documentos: process.env.AIRTABLE_VEH_DOCUMENTOS_TABLE_ID ? "✅ Configurado" : "❌ Faltante",
        licencias: process.env.AIRTABLE_VEH_LICENCIAS_TABLE_ID ? "✅ Configurado" : "❌ Faltante",
        alertas: process.env.AIRTABLE_VEH_ALERTAS_TABLE_ID ? "✅ Configurado" : "❌ Faltante",
      },
      fieldIds: {
        veh_id: process.env.AIRTABLE_VEH_VEH_ID ? "✅ Configurado" : "❌ Faltante",
        veh_placa: process.env.AIRTABLE_VEH_VEH_PLACA ? "✅ Configurado" : "❌ Faltante",
        doc_id: process.env.AIRTABLE_VEH_DOC_ID ? "✅ Configurado" : "❌ Faltante",
        lic_id: process.env.AIRTABLE_VEH_LIC_ID ? "✅ Configurado" : "❌ Faltante",
      },
      sendgrid: {
        apiKey: process.env.SENDGRID_API_KEY ? "✅ Configurado" : "❌ Faltante",
        fromEmail: process.env.SENDGRID_FROM_EMAIL || "❌ Faltante",
        responsableEmail: process.env.SENDGRID_RESPONSABLE_SST_EMAIL || "❌ Faltante",
      },
    },
    variablesFaltantes: [] as string[],
    pasosSiguientes: [] as string[],
  };

  // Contar variables faltantes
  const tablasFaltantes = Object.entries(diagnostico.configuracion.tablas)
    .filter(([_, valor]) => valor === "❌ Faltante")
    .map(([nombre]) => nombre);

  if (tablasFaltantes.length > 0) {
    diagnostico.variablesFaltantes.push(`Tablas: ${tablasFaltantes.join(", ")}`);
  }

  const fieldsFaltantes = Object.entries(diagnostico.configuracion.fieldIds)
    .filter(([_, valor]) => valor === "❌ Faltante")
    .map(([nombre]) => nombre);

  if (fieldsFaltantes.length > 0) {
    diagnostico.variablesFaltantes.push(`Field IDs: ${fieldsFaltantes.join(", ")}`);
  }

  // Determinar estado general
  const totalVariables =
    Object.keys(diagnostico.configuracion.tablas).length +
    Object.keys(diagnostico.configuracion.fieldIds).length;

  const variablesConfiguradas =
    Object.values(diagnostico.configuracion.tablas).filter(v => v === "✅ Configurado").length +
    Object.values(diagnostico.configuracion.fieldIds).filter(v => v === "✅ Configurado").length;

  const porcentaje = Math.round((variablesConfiguradas / totalVariables) * 100);

  if (porcentaje === 100) {
    diagnostico.estado = "✅ Configuración completa";
    diagnostico.pasosSiguientes = [
      "El módulo está listo para usar",
      "Prueba registrar un vehículo en http://localhost:3001/dashboard/sgsst/vehicular",
    ];
  } else if (porcentaje === 0) {
    diagnostico.estado = "❌ Sin configurar";
    diagnostico.pasosSiguientes = [
      "1. Crear las 4 tablas en Airtable (ver GUIA_RAPIDA_VEHICULAR.md)",
      "2. Copiar los field IDs de cada tabla",
      "3. Agregar las variables a .env.local",
      "4. Reiniciar el servidor (npm run dev)",
      "",
      "📖 Guía completa: GUIA_RAPIDA_VEHICULAR.md (setup en 30 min)",
    ];
  } else {
    diagnostico.estado = `🚧 Configuración parcial (${porcentaje}%)`;
    diagnostico.pasosSiguientes = [
      "Completar las variables faltantes en .env.local",
      "Ver .env.example para el formato correcto",
      "Reiniciar el servidor después de agregar variables",
    ];
  }

  return NextResponse.json(diagnostico, {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  });
}
