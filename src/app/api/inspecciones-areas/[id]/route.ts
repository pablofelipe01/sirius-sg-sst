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

interface AirtableResponse {
  records: AirtableRecord[];
}

/**
 * GET /api/inspecciones-areas/[id]
 * Obtiene el detalle completo de una inspección de área
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const {
      inspeccionesAreasFields,
      detalleInspeccionAreasFields,
      respInspeccionAreasFields,
      accionesCorrectivasAreasFields,
    } = airtableSGSSTConfig;

    // 1. Buscar la cabecera de la inspección
    const cabeceraUrl = getSGSSTUrl(airtableSGSSTConfig.inspeccionesAreasTableId);
    const filterFormula = `{${inspeccionesAreasFields.ID}} = '${id}'`;

    const params1 = new URLSearchParams({
      filterByFormula: filterFormula,
      returnFieldsByFieldId: "true",
    });

    const cabeceraResponse = await fetch(`${cabeceraUrl}?${params1.toString()}`, {
      method: "GET",
      headers: getSGSSTHeaders(),
      cache: "no-store",
    });

    if (!cabeceraResponse.ok) {
      return NextResponse.json(
        { success: false, message: "Error al consultar la inspección" },
        { status: 500 }
      );
    }

    const cabeceraData: AirtableResponse = await cabeceraResponse.json();

    if (cabeceraData.records.length === 0) {
      return NextResponse.json(
        { success: false, message: "Inspección no encontrada" },
        { status: 404 }
      );
    }

    const cabecera = cabeceraData.records[0];
    const cabeceraRecordId = cabecera.id;
    // IMPORTANTE: El parámetro 'id' es el idInspeccion (ej: "INSPA-PIR-...")
    // ARRAYJOIN devuelve el campo primario (idInspeccion), no el record ID
    // Por eso usamos 'id' directamente en los filtros ARRAYJOIN

    // 2. Obtener detalles (criterios evaluados)
    // IMPORTANTE: Airtable requiere usar el NOMBRE del campo en fórmulas, no el field ID
    // Y ARRAYJOIN devuelve el campo primario (idInspeccion), no el record ID
    const detalleUrl = getSGSSTUrl(airtableSGSSTConfig.detalleInspeccionAreasTableId);
    const detalleFilter = `FIND('${id}', ARRAYJOIN({Inspección})) > 0`;

    const params2 = new URLSearchParams({
      filterByFormula: detalleFilter,
      returnFieldsByFieldId: "true",
    });

    const detalleResponse = await fetch(`${detalleUrl}?${params2.toString()}`, {
      method: "GET",
      headers: getSGSSTHeaders(),
      cache: "no-store",
    });

    let criterios: unknown[] = [];
    if (detalleResponse.ok) {
      const detalleData: AirtableResponse = await detalleResponse.json();
      criterios = detalleData.records.map((r) => ({
        id: r.id,
        categoria: r.fields[detalleInspeccionAreasFields.CATEGORIA] as string,
        criterio: r.fields[detalleInspeccionAreasFields.CRITERIO] as string,
        condicion: r.fields[detalleInspeccionAreasFields.CONDICION] as string,
        observacion: (r.fields[detalleInspeccionAreasFields.OBSERVACION] as string) || "",
      }));
    }

    // 3. Obtener acciones correctivas
    // IMPORTANTE: Airtable requiere usar el NOMBRE del campo en fórmulas, no el field ID
    // Y ARRAYJOIN devuelve el campo primario (idInspeccion), no el record ID
    const accionesUrl = getSGSSTUrl(airtableSGSSTConfig.accionesCorrectivasAreasTableId);
    const accionesFilter = `FIND('${id}', ARRAYJOIN({Inspección})) > 0`;

    const params3 = new URLSearchParams({
      filterByFormula: accionesFilter,
      returnFieldsByFieldId: "true",
    });

    const accionesResponse = await fetch(`${accionesUrl}?${params3.toString()}`, {
      method: "GET",
      headers: getSGSSTHeaders(),
      cache: "no-store",
    });

    let acciones: unknown[] = [];
    if (accionesResponse.ok) {
      const accionesData: AirtableResponse = await accionesResponse.json();
      acciones = accionesData.records.map((r) => {
        // Obtener el criterio relacionado si existe
        const criterioLinkIds = r.fields[accionesCorrectivasAreasFields.CRITERIO_LINK] as string[] | undefined;
        const criterioRelacionadoId = criterioLinkIds?.[0] || null;
        
        // Buscar el criterio en la lista de criterios cargados
        const criterioRelacionado = criterioRelacionadoId 
          ? (criterios as { id: string; categoria: string; criterio: string; condicion: string }[]).find(c => c.id === criterioRelacionadoId)
          : null;

        return {
          id: r.id,
          descripcion: r.fields[accionesCorrectivasAreasFields.DESCRIPCION] as string,
          tipo: r.fields[accionesCorrectivasAreasFields.TIPO] as string,
          responsable: r.fields[accionesCorrectivasAreasFields.RESPONSABLE] as string,
          fechaPropuesta: r.fields[accionesCorrectivasAreasFields.FECHA_PROPUESTA] as string,
          estado: r.fields[accionesCorrectivasAreasFields.ESTADO] as string,
          fechaCierre: (r.fields[accionesCorrectivasAreasFields.FECHA_CIERRE] as string) || null,
          evidenciaUrl: (r.fields[accionesCorrectivasAreasFields.EVIDENCIA_URL] as string) || null,
          // Información del criterio relacionado
          criterioRelacionado: criterioRelacionado ? {
            id: criterioRelacionado.id,
            categoria: criterioRelacionado.categoria,
            criterio: criterioRelacionado.criterio,
            condicion: criterioRelacionado.condicion,
          } : null,
        };
      });
    }

    // 4. Obtener responsables (sin descifrar firmas)
    // IMPORTANTE: Usar el NOMBRE del campo y el idInspeccion (lo que ARRAYJOIN devuelve)
    const respUrl = getSGSSTUrl(airtableSGSSTConfig.respInspeccionAreasTableId);
    const respFilter = `FIND('${id}', ARRAYJOIN({Inspección})) > 0`;

    const params4 = new URLSearchParams({
      filterByFormula: respFilter,
      returnFieldsByFieldId: "true",
    });

    const respResponse = await fetch(`${respUrl}?${params4.toString()}`, {
      method: "GET",
      headers: getSGSSTHeaders(),
      cache: "no-store",
    });

    let responsables: unknown[] = [];
    if (respResponse.ok) {
      const respData: AirtableResponse = await respResponse.json();
      responsables = respData.records.map((r) => ({
        id: r.id,
        tipo: r.fields[respInspeccionAreasFields.TIPO] as string,
        nombre: r.fields[respInspeccionAreasFields.NOMBRE] as string,
        cedula: r.fields[respInspeccionAreasFields.CEDULA] as string,
        cargo: r.fields[respInspeccionAreasFields.CARGO] as string,
        fechaFirma: r.fields[respInspeccionAreasFields.FECHA_FIRMA] as string,
        // Devolver el hash de la firma para que el frontend pueda solicitar descifrado
        firmaHash: (r.fields[respInspeccionAreasFields.FIRMA] as string) || null,
      }));
    }

    // 5. Construir respuesta
    const inspeccion = {
      id: cabecera.fields[inspeccionesAreasFields.ID] as string,
      idInspeccion: cabecera.fields[inspeccionesAreasFields.ID] as string,
      recordId: cabeceraRecordId,
      fecha: cabecera.fields[inspeccionesAreasFields.FECHA] as string,
      inspector: cabecera.fields[inspeccionesAreasFields.INSPECTOR] as string,
      area: cabecera.fields[inspeccionesAreasFields.AREA] as string,
      estado: cabecera.fields[inspeccionesAreasFields.ESTADO] as string,
      observaciones: (cabecera.fields[inspeccionesAreasFields.OBSERVACIONES] as string) || "",
      urlDocumento: (cabecera.fields[inspeccionesAreasFields.URL_DOCUMENTO] as string) || null,
      fechaExportacion: (cabecera.fields[inspeccionesAreasFields.FECHA_EXPORTACION] as string) || null,
      criterios,
      acciones,
      responsables,
    };

    return NextResponse.json({
      success: true,
      data: inspeccion,
    });
  } catch (error) {
    console.error("Error en GET /api/inspecciones-areas/[id]:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
