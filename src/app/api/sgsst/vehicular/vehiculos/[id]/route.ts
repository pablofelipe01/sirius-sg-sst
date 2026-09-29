// ══════════════════════════════════════════════════════════
// GET /api/sgsst/vehicular/vehiculos/:id — Obtener vehículo por ID
// PUT /api/sgsst/vehicular/vehiculos/:id — Actualizar vehículo
// DELETE /api/sgsst/vehicular/vehiculos/:id — Desactivar (soft delete)
// ══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { airtableSGSSTConfig, getSGSSTUrl, getSGSSTHeaders } from "@/infrastructure/config/airtableSGSST";
import { airtableConfig } from "@/infrastructure/config/airtable";

interface Params {
  params: Promise<{
    id: string;
  }>;
}

const TIPOS_VEHICULO = ["Motocicleta", "Automóvil", "Camioneta", "Camión", "Bicicleta", "Otro"];
const TIPOS_PROPIETARIO = ["Colaborador", "Tercero", "Empresa"];

type EstadoDocumento = "Vigente" | "Por vencer" | "Vencido" | "Sin registro";

/**
 * Calcula días restantes y estado basado en fecha de vencimiento
 */
function calcularEstado(fechaVencimiento: string | null): {
  estado: EstadoDocumento;
  diasRestantes: number | null;
} {
  if (!fechaVencimiento) {
    return { estado: "Sin registro", diasRestantes: null };
  }

  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const vencimiento = new Date(fechaVencimiento);
  vencimiento.setHours(0, 0, 0, 0);

  const diffTime = vencimiento.getTime() - hoy.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  if (diffDays < 0) {
    return { estado: "Vencido", diasRestantes: diffDays };
  } else if (diffDays <= 30) {
    return { estado: "Por vencer", diasRestantes: diffDays };
  } else {
    return { estado: "Vigente", diasRestantes: diffDays };
  }
}

/**
 * Determina el estado consolidado del vehículo
 */
function determinarEstadoConsolidado(
  estadoSoat: EstadoDocumento,
  estadoTecno: EstadoDocumento,
  estadoLic: EstadoDocumento
): "ok" | "alerta" | "critico" {
  const estados = [estadoSoat, estadoTecno, estadoLic];

  if (estados.includes("Vencido")) {
    return "critico";
  }
  if (estados.includes("Por vencer")) {
    return "alerta";
  }
  return "ok";
}

export async function GET(request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;

    const vehConfig = airtableSGSSTConfig;
    const headers = getSGSSTHeaders();

    // 1. Obtener el vehículo específico
    const vehUrl = `${getSGSSTUrl(vehConfig.vehiculosTableId)}/${id}?returnFieldsByFieldId=true`;
    const vehResponse = await fetch(vehUrl, { headers });

    if (!vehResponse.ok) {
      if (vehResponse.status === 404) {
        return NextResponse.json(
          { error: "Vehículo no encontrado" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Error al consultar vehículo" },
        { status: vehResponse.status }
      );
    }

    const vehData = await vehResponse.json();
    const fields = vehData.fields;
    const vehiculoId = vehData.id;
    const idPersonalCore = fields[vehConfig.vehiculosFields.ID_PERSONAL_CORE] || "";

    // 2. Obtener documentos (SOAT y Tecnomecánica)
    const docUrl = getSGSSTUrl(vehConfig.documentosVehicularesTableId);
    const filterFormula = `FIND('${vehiculoId}', {${vehConfig.documentosVehicularesFields.VEHICULO_LINK}}) > 0`;
    const docResponse = await fetch(
      `${docUrl}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(filterFormula)}`,
      { headers }
    );
    const docData = docResponse.ok ? await docResponse.json() : { records: [] };
    const documentos = docData.records || [];

    // Buscar SOAT
    const soatDoc = documentos.find(
      (d: any) => d.fields[vehConfig.documentosVehicularesFields.TIPO_DOCUMENTO] === "SOAT"
    );
    const soatVencimiento = soatDoc?.fields[vehConfig.documentosVehicularesFields.FECHA_VENCIMIENTO] || null;
    const soatEstado = calcularEstado(soatVencimiento);

    // Buscar Tecnomecánica
    const tecnoDoc = documentos.find(
      (d: any) => d.fields[vehConfig.documentosVehicularesFields.TIPO_DOCUMENTO]?.includes("Tecno")
    );
    const tecnoVencimiento = tecnoDoc?.fields[vehConfig.documentosVehicularesFields.FECHA_VENCIMIENTO] || null;
    const tecnoEstado = calcularEstado(tecnoVencimiento);

    // 3. Obtener licencia del colaborador
    let licVencimiento: string | null = null;
    let licEstado = calcularEstado(null);
    let licCategoria = null;

    if (idPersonalCore) {
      const licUrl = getSGSSTUrl(vehConfig.licenciasConduccionTableId);
      const licFilterFormula = `{${vehConfig.licenciasConduccionFields.ID_PERSONAL_CORE}} = '${idPersonalCore}'`;
      const licResponse = await fetch(
        `${licUrl}?returnFieldsByFieldId=true&filterByFormula=${encodeURIComponent(licFilterFormula)}`,
        { headers }
      );
      const licData = licResponse.ok ? await licResponse.json() : { records: [] };
      const licencia = licData.records?.[0];

      if (licencia) {
        licVencimiento = licencia.fields[vehConfig.licenciasConduccionFields.FECHA_VENCIMIENTO] || null;
        licEstado = calcularEstado(licVencimiento);
        licCategoria = licencia.fields[vehConfig.licenciasConduccionFields.CATEGORIA] || null;
      }
    }

    // 4. Resolver nombre del colaborador desde Nómina Core
    let nombreColaborador = "Sin datos";
    let areaColaborador = "Sin área";

    if (idPersonalCore) {
      try {
        const personalUrl = `${airtableConfig.baseUrl}/${airtableConfig.baseId}/${airtableConfig.personalTableId}`;
        const personalFilter = `{ID Empleado} = '${idPersonalCore}'`;
        const personalResponse = await fetch(
          `${personalUrl}?filterByFormula=${encodeURIComponent(personalFilter)}`,
          {
            headers: {
              Authorization: `Bearer ${airtableConfig.apiToken}`,
              "Content-Type": "application/json",
            },
          }
        );

        if (personalResponse.ok) {
          const personalData = await personalResponse.json();
          if (personalData.records && personalData.records.length > 0) {
            const personalFields = personalData.records[0].fields;
            nombreColaborador = personalFields["Nombre completo"] || "Sin nombre";
            const areas = personalFields["Areas"];
            areaColaborador = Array.isArray(areas) ? areas[0] : (areas || "Sin área");
          }
        }
      } catch (error) {
        console.error("Error resolviendo colaborador:", error);
      }
    }

    // 5. Estado consolidado
    const estadoConsolidado = determinarEstadoConsolidado(
      soatEstado.estado,
      tecnoEstado.estado,
      licEstado.estado
    );

    // 6. Construir respuesta
    const resultado = {
      id: vehiculoId,
      idPersonalCore,
      nombreColaborador,
      areaColaborador,
      placa: fields[vehConfig.vehiculosFields.PLACA] || "",
      tipoVehiculo: fields[vehConfig.vehiculosFields.TIPO_VEHICULO] || "Otro",
      propietarioNombre: fields[vehConfig.vehiculosFields.PROPIETARIO_NOMBRE] || "",
      propietarioTipo: fields[vehConfig.vehiculosFields.PROPIETARIO_TIPO] || "",
      propietarioDocumento: fields[vehConfig.vehiculosFields.PROPIETARIO_DOCUMENTO] || "",
      activo: fields[vehConfig.vehiculosFields.ACTIVO] || false,
      soat: {
        estado: soatEstado.estado,
        fechaVencimiento: soatVencimiento,
        diasRestantes: soatEstado.diasRestantes,
      },
      tecnomecanica: {
        estado: tecnoEstado.estado,
        fechaVencimiento: tecnoVencimiento,
        diasRestantes: tecnoEstado.diasRestantes,
      },
      licencia: {
        estado: licEstado.estado,
        fechaVencimiento: licVencimiento,
        diasRestantes: licEstado.diasRestantes,
        categoria: licCategoria,
      },
      estadoConsolidado,
    };

    return NextResponse.json({
      success: true,
      vehiculo: resultado,
    });
  } catch (error) {
    console.error("Error en GET /api/sgsst/vehicular/vehiculos/:id:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;
    const body = await request.json();

    const {
      placa,
      tipoVehiculo,
      propietarioNombre,
      propietarioTipo,
      propietarioDocumento,
      activo,
      observaciones,
    } = body;

    const vehConfig = airtableSGSSTConfig;
    const vehUrl = `${getSGSSTUrl(vehConfig.vehiculosTableId)}/${id}`;
    const headers = getSGSSTHeaders();

    // Construir payload solo con campos proporcionados
    const fields: Record<string, any> = {};

    if (placa !== undefined) {
      fields[vehConfig.vehiculosFields.PLACA] = placa.toUpperCase().trim();
    }
    if (tipoVehiculo !== undefined) {
      if (!TIPOS_VEHICULO.includes(tipoVehiculo)) {
        return NextResponse.json(
          { error: `Tipo de vehículo inválido. Valores permitidos: ${TIPOS_VEHICULO.join(", ")}` },
          { status: 400 }
        );
      }
      fields[vehConfig.vehiculosFields.TIPO_VEHICULO] = tipoVehiculo;
    }
    if (propietarioNombre !== undefined) {
      fields[vehConfig.vehiculosFields.PROPIETARIO_NOMBRE] = propietarioNombre;
    }
    if (propietarioTipo !== undefined) {
      if (!TIPOS_PROPIETARIO.includes(propietarioTipo)) {
        return NextResponse.json(
          { error: `Tipo de propietario inválido. Valores permitidos: ${TIPOS_PROPIETARIO.join(", ")}` },
          { status: 400 }
        );
      }
      fields[vehConfig.vehiculosFields.PROPIETARIO_TIPO] = propietarioTipo;
    }
    if (propietarioDocumento !== undefined) {
      fields[vehConfig.vehiculosFields.PROPIETARIO_DOCUMENTO] = propietarioDocumento;
    }
    if (activo !== undefined) {
      fields[vehConfig.vehiculosFields.ACTIVO] = activo;
    }
    if (observaciones !== undefined) {
      fields[vehConfig.vehiculosFields.OBSERVACIONES] = observaciones;
    }

    fields[vehConfig.vehiculosFields.UPDATED_AT] = new Date().toISOString();

    const updateResponse = await fetch(vehUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ fields }),
    });

    if (!updateResponse.ok) {
      const errorData = await updateResponse.json();
      console.error("Error actualizando vehículo:", errorData);
      return NextResponse.json(
        { error: "Error al actualizar vehículo" },
        { status: updateResponse.status }
      );
    }

    const updatedVehiculo = await updateResponse.json();

    return NextResponse.json({
      success: true,
      message: "Vehículo actualizado exitosamente",
      vehiculo: {
        id: updatedVehiculo.id,
        ...updatedVehiculo.fields,
      },
    });
  } catch (error) {
    console.error("Error en PUT /api/sgsst/vehicular/vehiculos/:id:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, context: Params) {
  try {
    const { id } = await context.params;

    const vehConfig = airtableSGSSTConfig;
    const vehUrl = `${getSGSSTUrl(vehConfig.vehiculosTableId)}/${id}`;
    const headers = getSGSSTHeaders();

    // Soft delete: marcar como inactivo
    const payload = {
      fields: {
        [vehConfig.vehiculosFields.ACTIVO]: false,
        [vehConfig.vehiculosFields.UPDATED_AT]: new Date().toISOString(),
      },
    };

    const deleteResponse = await fetch(vehUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify(payload),
    });

    if (!deleteResponse.ok) {
      const errorData = await deleteResponse.json();
      console.error("Error desactivando vehículo:", errorData);
      return NextResponse.json(
        { error: "Error al desactivar vehículo" },
        { status: deleteResponse.status }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Vehículo desactivado exitosamente",
    });
  } catch (error) {
    console.error("Error en DELETE /api/sgsst/vehicular/vehiculos/:id:", error);
    return NextResponse.json(
      { error: "Error al procesar la solicitud" },
      { status: 500 }
    );
  }
}
