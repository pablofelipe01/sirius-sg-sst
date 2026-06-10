// ══════════════════════════════════════════════════════════
// POST /api/inducciones/constancia
// Guardar constancia de realización de inducción
// ══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { airtableInduccionesConfig } from "@/infrastructure/config/airtableInducciones";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      induccionId,
      fechaRealizacion,
      lugarRealizacion,
      horaInicio,
      horaFin,
      responsableSST,
      observaciones,
    } = body;

    // Validar campos requeridos
    if (!induccionId || !fechaRealizacion || !lugarRealizacion || !horaInicio || !horaFin || !responsableSST) {
      return NextResponse.json(
        {
          success: false,
          message: "Faltan campos requeridos: induccionId, fechaRealizacion, lugarRealizacion, horaInicio, horaFin, responsableSST",
        },
        { status: 400 }
      );
    }

    const { constanciasTableId, constanciasFields: CF } = airtableInduccionesConfig;
    const { registrosTableId, registrosFields: RF } = airtableInduccionesConfig;
    const { baseUrl, headers } = createInduccionesClient();

    // 1. Buscar el registro de inducción para obtener su Record ID
    const filterFormula = `{ID_Induccion} = '${induccionId}'`;
    const searchUrl = `${baseUrl}/${registrosTableId}?filterByFormula=${encodeURIComponent(filterFormula)}&maxRecords=1`;

    const searchRes = await fetch(searchUrl, { headers, cache: "no-store" });

    if (!searchRes.ok) {
      console.error("[Constancia] Error buscando inducción:", await searchRes.text());
      return NextResponse.json(
        { success: false, message: "Error buscando la inducción" },
        { status: 500 }
      );
    }

    const searchData = await searchRes.json();
    const registroRecord = searchData.records?.[0];

    if (!registroRecord) {
      return NextResponse.json(
        { success: false, message: "Inducción no encontrada" },
        { status: 404 }
      );
    }

    // 2. Generar ID de constancia
    const timestamp = Date.now().toString().slice(-6);
    const idConstancia = `CONST-IND-${timestamp}`;

    // 3. Crear registro de constancia en Airtable
    const createUrl = `${baseUrl}/${constanciasTableId}`;
    const createRes = await fetch(createUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        records: [
          {
            fields: {
              [CF.ID_CONSTANCIA]: idConstancia,
              [CF.ID_INDUCCION]: [registroRecord.id], // Link al registro
              [CF.FECHA_REALIZACION]: fechaRealizacion,
              [CF.LUGAR_REALIZACION]: lugarRealizacion,
              [CF.HORA_INICIO]: horaInicio,
              [CF.HORA_FIN]: horaFin,
              [CF.RESPONSABLE_SST]: responsableSST,
              [CF.OBSERVACIONES]: observaciones || "",
            },
          },
        ],
      }),
    });

    if (!createRes.ok) {
      const errorText = await createRes.text();
      console.error("[Constancia] Error creando constancia:", errorText);
      return NextResponse.json(
        { success: false, message: "Error al guardar la constancia" },
        { status: 500 }
      );
    }

    const createData = await createRes.json();
    const constanciaRecord = createData.records[0];

    return NextResponse.json({
      success: true,
      message: "Constancia guardada exitosamente",
      data: {
        id: constanciaRecord.id,
        idConstancia,
        induccionId,
        fechaRealizacion,
        lugarRealizacion,
        horaInicio,
        horaFin,
        responsableSST,
        observaciones,
      },
    });
  } catch (error: any) {
    console.error("[Constancia] Error en POST:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}

// Helper: Crear cliente Airtable
function createInduccionesClient() {
  const { apiToken, baseId, baseUrl } = airtableInduccionesConfig;

  return {
    baseUrl: `${baseUrl}/${baseId}`,
    headers: {
      Authorization: `Bearer ${apiToken}`,
      "Content-Type": "application/json",
    },
  };
}
