import { NextRequest, NextResponse } from "next/server";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

// Mapeo de áreas a IDs Core
const AREA_TO_ID_CORE: Record<string, string> = {
  "Laboratorio": "SIRIUS-AREA-0005",
  "Pirólisis": "SIRIUS-AREA-0007",
  "Bodega": "SIRIUS-AREA-0008",
  "Administrativa": "SIRIUS-AREA-0002",
};

/**
 * GET /api/equipos-emergencia
 * Devuelve la lista de equipos de emergencia.
 * Query params:
 * - includeInactive=true: incluye equipos inactivos
 */
export async function GET(request: NextRequest) {
  try {
    const { equiposFields } = airtableSGSSTConfig;
    const url = getSGSSTUrl(airtableSGSSTConfig.equiposTableId);
    const { searchParams } = new URL(request.url);
    const includeInactive = searchParams.get("includeInactive") === "true";

    let allRecords: AirtableRecord[] = [];
    let offset: string | undefined;

    do {
      const params = new URLSearchParams({
        pageSize: "100",
        returnFieldsByFieldId: "true",
        "sort[0][field]": equiposFields.AREA,
        "sort[0][direction]": "asc",
        "sort[1][field]": equiposFields.CATEGORIA,
        "sort[1][direction]": "asc",
      });
      
      if (!includeInactive) {
        params.set("filterByFormula", `{Estado} = 'Activo'`);
      }
      
      if (offset) params.set("offset", offset);

      const response = await fetch(`${url}?${params.toString()}`, {
        method: "GET",
        headers: getSGSSTHeaders(),
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error listando equipos:", errorText);
        return NextResponse.json(
          { success: false, message: "Error al consultar equipos" },
          { status: 500 }
        );
      }

      const data: AirtableListResponse = await response.json();
      allRecords = allRecords.concat(data.records);
      offset = data.offset;
    } while (offset);

    const equipos = allRecords.map((record) => ({
      id: record.id,
      codigo: (record.fields[equiposFields.CODIGO] as string) || "",
      nombre: (record.fields[equiposFields.NOMBRE] as string) || "",
      categoria: (record.fields[equiposFields.CATEGORIA] as string) || "",
      tipoEspecifico: (record.fields[equiposFields.TIPO_ESPECIFICO] as string) || "",
      area: (record.fields[equiposFields.AREA] as string) || "",
      idAreaCore: (record.fields[equiposFields.ID_AREA_CORE] as string) || "",
      ubicacion: (record.fields[equiposFields.UBICACION] as string) || "",
      capacidad: (record.fields[equiposFields.CAPACIDAD] as string) || "",
      fechaVencimiento: (record.fields[equiposFields.FECHA_VENCIMIENTO] as string) || null,
      estado: (record.fields[equiposFields.ESTADO] as string) || "",
      descripcion: (record.fields[equiposFields.DESCRIPCION] as string) || "",
    }));

    return NextResponse.json({
      success: true,
      data: equipos,
      total: equipos.length,
    });
  } catch (error) {
    console.error("Error en GET /api/equipos-emergencia:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/equipos-emergencia
 * Crea un nuevo equipo de emergencia.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { equiposFields } = airtableSGSSTConfig;
    const url = getSGSSTUrl(airtableSGSSTConfig.equiposTableId);

    // Validaciones básicas
    if (!body.codigo || !body.nombre || !body.categoria || !body.area) {
      return NextResponse.json(
        { success: false, message: "Código, nombre, categoría y área son requeridos" },
        { status: 400 }
      );
    }

    // Construir campos para Airtable
    const fields: Record<string, unknown> = {
      [equiposFields.CODIGO]: body.codigo,
      [equiposFields.NOMBRE]: body.nombre,
      [equiposFields.CATEGORIA]: body.categoria,
      [equiposFields.AREA]: body.area,
      [equiposFields.ID_AREA_CORE]: AREA_TO_ID_CORE[body.area] || "",
      [equiposFields.ESTADO]: body.estado || "Activo",
    };

    if (body.tipoEspecifico) fields[equiposFields.TIPO_ESPECIFICO] = body.tipoEspecifico;
    if (body.ubicacion) fields[equiposFields.UBICACION] = body.ubicacion;
    if (body.capacidad) fields[equiposFields.CAPACIDAD] = body.capacidad;
    if (body.fechaVencimiento) fields[equiposFields.FECHA_VENCIMIENTO] = body.fechaVencimiento;
    if (body.descripcion) fields[equiposFields.DESCRIPCION] = body.descripcion;

    const response = await fetch(url, {
      method: "POST",
      headers: getSGSSTHeaders(),
      body: JSON.stringify({ fields, typecast: true }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error creando equipo:", errorText);
      return NextResponse.json(
        { success: false, message: "Error al crear el equipo" },
        { status: 500 }
      );
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: "Equipo creado exitosamente",
      data: {
        id: data.id,
        codigo: body.codigo,
        nombre: body.nombre,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/equipos-emergencia:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/equipos-emergencia
 * Actualiza un equipo existente.
 */
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { equiposFields } = airtableSGSSTConfig;

    if (!body.id) {
      return NextResponse.json(
        { success: false, message: "ID del equipo es requerido" },
        { status: 400 }
      );
    }

    const url = `${getSGSSTUrl(airtableSGSSTConfig.equiposTableId)}/${body.id}`;

    // Construir campos a actualizar
    const fields: Record<string, unknown> = {};

    if (body.codigo !== undefined) fields[equiposFields.CODIGO] = body.codigo;
    if (body.nombre !== undefined) fields[equiposFields.NOMBRE] = body.nombre;
    if (body.categoria !== undefined) fields[equiposFields.CATEGORIA] = body.categoria;
    if (body.tipoEspecifico !== undefined) fields[equiposFields.TIPO_ESPECIFICO] = body.tipoEspecifico;
    if (body.area !== undefined) {
      fields[equiposFields.AREA] = body.area;
      fields[equiposFields.ID_AREA_CORE] = AREA_TO_ID_CORE[body.area] || "";
    }
    if (body.ubicacion !== undefined) fields[equiposFields.UBICACION] = body.ubicacion;
    if (body.capacidad !== undefined) fields[equiposFields.CAPACIDAD] = body.capacidad;
    if (body.fechaVencimiento !== undefined) fields[equiposFields.FECHA_VENCIMIENTO] = body.fechaVencimiento;
    if (body.estado !== undefined) fields[equiposFields.ESTADO] = body.estado;
    if (body.descripcion !== undefined) fields[equiposFields.DESCRIPCION] = body.descripcion;

    if (Object.keys(fields).length === 0) {
      return NextResponse.json(
        { success: false, message: "No hay campos para actualizar" },
        { status: 400 }
      );
    }

    const response = await fetch(url, {
      method: "PATCH",
      headers: getSGSSTHeaders(),
      body: JSON.stringify({ fields, typecast: true }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error actualizando equipo:", errorText);
      return NextResponse.json(
        { success: false, message: "Error al actualizar el equipo" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Equipo actualizado exitosamente",
    });
  } catch (error) {
    console.error("Error en PUT /api/equipos-emergencia:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/equipos-emergencia
 * Elimina (soft-delete) un equipo marcándolo como Inactivo.
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id");
    const { equiposFields } = airtableSGSSTConfig;

    if (!id) {
      return NextResponse.json(
        { success: false, message: "ID del equipo es requerido" },
        { status: 400 }
      );
    }

    const url = `${getSGSSTUrl(airtableSGSSTConfig.equiposTableId)}/${id}`;

    // Soft delete: marcar como Inactivo
    const response = await fetch(url, {
      method: "PATCH",
      headers: getSGSSTHeaders(),
      body: JSON.stringify({
        fields: { [equiposFields.ESTADO]: "Inactivo" },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error eliminando equipo:", errorText);
      return NextResponse.json(
        { success: false, message: "Error al eliminar el equipo" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Equipo eliminado exitosamente",
    });
  } catch (error) {
    console.error("Error en DELETE /api/equipos-emergencia:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
