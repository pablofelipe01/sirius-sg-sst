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

/**
 * GET /api/inspecciones-equipos/[id]
 * Devuelve el detalle de una inspección de equipos.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const { inspEquiposFields, detalleEquiposFields, respEquiposFields } =
      airtableSGSSTConfig;

    // 1. Obtener cabecera (con returnFieldsByFieldId para usar field IDs como keys)
    const cabeceraUrl = `${getSGSSTUrl(airtableSGSSTConfig.inspEquiposTableId)}/${id}?returnFieldsByFieldId=true`;
    const cabeceraRes = await fetch(cabeceraUrl, {
      headers: getSGSSTHeaders(),
      cache: "no-store",
    });

    if (!cabeceraRes.ok) {
      return NextResponse.json(
        { success: false, message: "Inspección no encontrada" },
        { status: 404 }
      );
    }

    const cabeceraData: AirtableRecord = await cabeceraRes.json();
    
    // Debug: ver qué campos tenemos
    console.log("Cabecera fields keys:", Object.keys(cabeceraData.fields));
    console.log("ID field value:", cabeceraData.fields[inspEquiposFields.ID]);

    const idInspeccion = (cabeceraData.fields[inspEquiposFields.ID] as string) || "";
    
    const inspeccion = {
      id: cabeceraData.id,
      idInspeccion,
      fecha: cabeceraData.fields[inspEquiposFields.FECHA] as string,
      inspector: cabeceraData.fields[inspEquiposFields.INSPECTOR] as string,
      estado: cabeceraData.fields[inspEquiposFields.ESTADO] as string,
      observaciones:
        (cabeceraData.fields[inspEquiposFields.OBSERVACIONES] as string) || "",
    };

    // Validar que tenemos el idInspeccion
    if (!idInspeccion) {
      console.error("idInspeccion no encontrado. Field ID:", inspEquiposFields.ID);
      console.error("Fields disponibles:", Object.keys(cabeceraData.fields));
      return NextResponse.json({
        success: true,
        data: { ...inspeccion, detalles: [], responsables: [], totalEquipos: 0 },
      });
    }

    // 2. Obtener detalles vinculados
    // Los detalles tienen un ID que incluye el idInspeccion (ej: "INSPEQ-20260324-XXX-EQ001")
    // Usamos FIND para buscar el idInspeccion dentro del campo ID
    const detalleUrl = getSGSSTUrl(airtableSGSSTConfig.detalleEquiposTableId);
    
    // Probar múltiples nombres de campo posibles para el ID
    const detalleFilter = `FIND('${idInspeccion}', {ID Detalle}) > 0`;
    console.log("Buscando detalles con filtro:", detalleFilter);
    
    const detalleParams = new URLSearchParams({
      filterByFormula: detalleFilter,
      returnFieldsByFieldId: "true",
      pageSize: "100",
    });

    let allDetalles: AirtableRecord[] = [];
    let offset: string | undefined;

    do {
      if (offset) detalleParams.set("offset", offset);
      const res = await fetch(`${detalleUrl}?${detalleParams.toString()}`, {
        headers: getSGSSTHeaders(),
        cache: "no-store",
      });

      if (res.ok) {
        const data: AirtableListResponse = await res.json();
        allDetalles = allDetalles.concat(data.records);
        offset = data.offset;
      } else {
        console.error("Error fetching detalles:", await res.text());
        break;
      }
    } while (offset);
    
    console.log("Detalles encontrados:", allDetalles.length);

    // Resolver nombres de equipos
    const equipoIds = allDetalles
      .map((r) => {
        const links = r.fields[detalleEquiposFields.EQUIPO_LINK] as string[] | undefined;
        return links?.[0];
      })
      .filter(Boolean) as string[];

    const equipoNames: Record<string, { nombre: string; codigo: string }> = {};
    if (equipoIds.length > 0) {
      const { equiposFields } = airtableSGSSTConfig;
      const equipoUrl = getSGSSTUrl(airtableSGSSTConfig.equiposTableId);

      // Fetch equipment records in batches
      const uniqueIds = [...new Set(equipoIds)];
      for (let i = 0; i < uniqueIds.length; i += 10) {
        const batch = uniqueIds.slice(i, i + 10);
        const formula = `OR(${batch.map((eid) => `RECORD_ID()='${eid}'`).join(",")})`;
        const eqParams = new URLSearchParams({
          filterByFormula: formula,
          returnFieldsByFieldId: "true",
          "fields[]": equiposFields.NOMBRE,
        });
        eqParams.append("fields[]", equiposFields.CODIGO);

        const eqRes = await fetch(`${equipoUrl}?${eqParams.toString()}`, {
          headers: getSGSSTHeaders(),
          cache: "no-store",
        });

        if (eqRes.ok) {
          const eqData: AirtableListResponse = await eqRes.json();
          eqData.records.forEach((r) => {
            equipoNames[r.id] = {
              nombre: (r.fields[equiposFields.NOMBRE] as string) || "",
              codigo: (r.fields[equiposFields.CODIGO] as string) || "",
            };
          });
        }
      }
    }

    const detalles = allDetalles.map((r) => {
      const equipoLink = (r.fields[detalleEquiposFields.EQUIPO_LINK] as string[])?.[0];
      const equipoInfo = equipoLink ? equipoNames[equipoLink] : undefined;

      return {
        id: r.id,
        idDetalle: (r.fields[detalleEquiposFields.ID] as string) || "",
        categoria: (r.fields[detalleEquiposFields.CATEGORIA] as string) || "",
        area: (r.fields[detalleEquiposFields.AREA] as string) || "",
        estadoGeneral: (r.fields[detalleEquiposFields.ESTADO_GENERAL] as string) || null,
        senalizacion: (r.fields[detalleEquiposFields.SENALIZACION] as string) || null,
        accesibilidad: (r.fields[detalleEquiposFields.ACCESIBILIDAD] as string) || null,
        presionManometro: (r.fields[detalleEquiposFields.PRESION_MANOMETRO] as string) || null,
        manguera: (r.fields[detalleEquiposFields.MANGUERA] as string) || null,
        pinSeguridad: (r.fields[detalleEquiposFields.PIN_SEGURIDAD] as string) || null,
        soporteBase: (r.fields[detalleEquiposFields.SOPORTE_BASE] as string) || null,
        completitudElementos: (r.fields[detalleEquiposFields.COMPLETITUD] as string) || null,
        estadoContenedor: (r.fields[detalleEquiposFields.ESTADO_CONTENEDOR] as string) || null,
        estructura: (r.fields[detalleEquiposFields.ESTRUCTURA] as string) || null,
        correasArnes: (r.fields[detalleEquiposFields.CORREAS] as string) || null,
        fechaVencimiento: (r.fields[detalleEquiposFields.FECHA_VENCIMIENTO] as string) || null,
        observaciones: (r.fields[detalleEquiposFields.OBSERVACIONES] as string) || "",
        fotoUrl: (r.fields[detalleEquiposFields.FOTO_URL] as string) || null,
        equipoNombre: equipoInfo?.nombre || "",
        equipoCodigo: equipoInfo?.codigo || "",
      };
    });

    // 3. Obtener responsables (firmas)
    // Los responsables tienen un ID que incluye el idInspeccion (ej: "INSPEQ-20260324-XXX-AREA-Lab")
    const respUrl = getSGSSTUrl(airtableSGSSTConfig.respEquiposTableId);
    const respFilter = `FIND('${idInspeccion}', {ID Firma}) > 0`;
    console.log("Buscando responsables con filtro:", respFilter);
    
    const respParams = new URLSearchParams({
      filterByFormula: respFilter,
      returnFieldsByFieldId: "true",
    });

    const respRes = await fetch(`${respUrl}?${respParams.toString()}`, {
      headers: getSGSSTHeaders(),
      cache: "no-store",
    });

    let responsables: { tipo: string; nombre: string; cedula: string; cargo: string }[] = [];
    if (respRes.ok) {
      const respData: AirtableListResponse = await respRes.json();
      responsables = respData.records.map((r) => ({
        tipo: (r.fields[respEquiposFields.TIPO] as string) || "",
        nombre: (r.fields[respEquiposFields.NOMBRE] as string) || "",
        cedula: (r.fields[respEquiposFields.CEDULA] as string) || "",
        cargo: (r.fields[respEquiposFields.CARGO] as string) || "",
      }));
      console.log("Responsables encontrados:", responsables.length);
    } else {
      console.error("Error fetching responsables:", await respRes.text());
    }

    return NextResponse.json({
      success: true,
      data: {
        ...inspeccion,
        detalles,
        responsables,
        totalEquipos: detalles.length,
      },
    });
  } catch (error) {
    console.error("Error en GET /api/inspecciones-equipos/[id]:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
