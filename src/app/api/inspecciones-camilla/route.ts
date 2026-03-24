import { NextRequest, NextResponse } from "next/server";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
type EstadoElemento = "Bueno" | "Regular" | "Malo" | "Faltante" | null;

interface CamillaItem {
  id: string;
  codigo: string;
  nombre: string;
  ubicacion: string;
  estado: string;
}

interface ElementoCamilla {
  id: string;
  codigo: string;
  nombre: string;
  cantidadEstandar: number;
}

interface DetalleCamillaPayload {
  camillaRecordId: string;
  elementoRecordId: string;
  estadoElemento: EstadoElemento;
  cantidad: number;
  observaciones: string;
}

interface ResponsablePayload {
  tipo: "Inspector" | "Responsable SG-SST" | "COPASST";
  nombre: string;
  cargo: string;
}

interface InspeccionCamillaPayload {
  fechaInspeccion: string;
  inspector: string;
  cargoInspector: string;
  observacionesGenerales: string;
  detalles: DetalleCamillaPayload[];
  responsables: ResponsablePayload[];
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableResponse {
  records: AirtableRecord[];
}

function generateInspeccionId(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const rnd = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INSPCAM-${y}${m}${d}-${rnd}`;
}

// ══════════════════════════════════════════════════════════
// GET /api/inspecciones-camilla
// Lista inspecciones, camillas y elementos
// ══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const camillas = searchParams.get("camillas") === "true";
    const elementos = searchParams.get("elementos") === "true";

    if (camillas) {
      // Cargar catálogo de camillas
      const { camillasFields } = airtableSGSSTConfig;
      const url = getSGSSTUrl(airtableSGSSTConfig.camillasTableId);

      const params = new URLSearchParams({
        filterByFormula: `{${camillasFields.ESTADO}} = 'Activo'`,
        "sort[0][field]": camillasFields.CODIGO,
        "sort[0][direction]": "asc",
        returnFieldsByFieldId: "true",
      });

      const response = await fetch(`${url}?${params.toString()}`, {
        method: "GET",
        headers: getSGSSTHeaders(),
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error cargando camillas:", errorText);
        return NextResponse.json(
          { success: false, error: "Error al cargar camillas" },
          { status: response.status }
        );
      }

      const data: AirtableResponse = await response.json();

      const items: CamillaItem[] = data.records.map((record) => ({
        id: record.id,
        codigo: (record.fields[camillasFields.CODIGO] as string) || "",
        nombre: (record.fields[camillasFields.NOMBRE] as string) || "",
        ubicacion: "", // Lookup
        estado: (record.fields[camillasFields.ESTADO] as string) || "",
      }));

      return NextResponse.json({ success: true, camillas: items });
    }

    if (elementos) {
      // Cargar catálogo de elementos de camilla
      const { elementosCamillaFields } = airtableSGSSTConfig;
      const url = getSGSSTUrl(airtableSGSSTConfig.elementosCamillaTableId);

      const params = new URLSearchParams({
        filterByFormula: `{${elementosCamillaFields.ESTADO}} = 'Activo'`,
        "sort[0][field]": elementosCamillaFields.NOMBRE,
        "sort[0][direction]": "asc",
        returnFieldsByFieldId: "true",
      });

      const response = await fetch(`${url}?${params.toString()}`, {
        method: "GET",
        headers: getSGSSTHeaders(),
        cache: "no-store",
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Error cargando elementos:", errorText);
        return NextResponse.json(
          { success: false, error: "Error al cargar elementos" },
          { status: response.status }
        );
      }

      const data: AirtableResponse = await response.json();

      const items: ElementoCamilla[] = data.records.map((record) => ({
        id: record.id,
        codigo: (record.fields[elementosCamillaFields.CODIGO] as string) || "",
        nombre: (record.fields[elementosCamillaFields.NOMBRE] as string) || "",
        cantidadEstandar: (record.fields[elementosCamillaFields.CANTIDAD_ESTANDAR] as number) || 1,
      }));

      return NextResponse.json({ success: true, elementos: items });
    }

    // Listar inspecciones existentes
    const { inspCamillaFields } = airtableSGSSTConfig;
    const url = getSGSSTUrl(airtableSGSSTConfig.inspCamillaTableId);

    const params = new URLSearchParams({
      "sort[0][field]": inspCamillaFields.FECHA,
      "sort[0][direction]": "desc",
      maxRecords: "100",
      returnFieldsByFieldId: "true",
    });

    const response = await fetch(`${url}?${params.toString()}`, {
      method: "GET",
      headers: getSGSSTHeaders(),
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Error listando inspecciones:", errorText);
      return NextResponse.json(
        { success: false, error: "Error al listar inspecciones" },
        { status: response.status }
      );
    }

    const data: AirtableResponse = await response.json();

    const inspecciones = data.records.map((record) => ({
      id: record.id,
      idInspeccion: record.fields[inspCamillaFields.ID] as string,
      fecha: record.fields[inspCamillaFields.FECHA] as string,
      inspector: record.fields[inspCamillaFields.INSPECTOR] as string,
      estado: record.fields[inspCamillaFields.ESTADO] as string,
      observaciones: record.fields[inspCamillaFields.OBSERVACIONES] as string,
      urlDocumento: record.fields[inspCamillaFields.URL_DOCUMENTO] as string,
      detallesCount: ((record.fields[inspCamillaFields.DETALLE_LINK] as string[]) || []).length,
    }));

    return NextResponse.json({ success: true, inspecciones });
  } catch (error) {
    console.error("Error en GET inspecciones-camilla:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-camilla
// Crear nueva inspección de camilla
// ══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const payload: InspeccionCamillaPayload = await request.json();

    const {
      inspCamillaFields,
      detalleCamillaFields,
      respCamillaFields,
    } = airtableSGSSTConfig;

    // 1. Crear registro de cabecera
    const inspeccionId = generateInspeccionId();
    const cabeceraUrl = getSGSSTUrl(airtableSGSSTConfig.inspCamillaTableId);

    const cabeceraResponse = await fetch(cabeceraUrl, {
      method: "POST",
      headers: getSGSSTHeaders(),
      body: JSON.stringify({
        fields: {
          [inspCamillaFields.ID]: inspeccionId,
          [inspCamillaFields.FECHA]: payload.fechaInspeccion,
          [inspCamillaFields.INSPECTOR]: payload.inspector,
          [inspCamillaFields.CARGO_INSPECTOR]: payload.cargoInspector,
          [inspCamillaFields.ESTADO]: "Borrador",
          [inspCamillaFields.OBSERVACIONES]: payload.observacionesGenerales,
        },
      }),
    });

    if (!cabeceraResponse.ok) {
      const errorText = await cabeceraResponse.text();
      console.error("Error creando cabecera:", errorText);
      return NextResponse.json(
        { success: false, error: "Error al crear inspección" },
        { status: cabeceraResponse.status }
      );
    }

    const cabeceraData = await cabeceraResponse.json();
    const cabeceraRecordId = cabeceraData.id;

    // 2. Crear registros de detalle
    const detalleUrl = getSGSSTUrl(airtableSGSSTConfig.detalleCamillaTableId);
    const detallePromises = payload.detalles.map((det) =>
      fetch(detalleUrl, {
        method: "POST",
        headers: getSGSSTHeaders(),
        body: JSON.stringify({
          fields: {
            [detalleCamillaFields.ID]: `DET-${inspeccionId}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            [detalleCamillaFields.INSPECCION_LINK]: [cabeceraRecordId],
            [detalleCamillaFields.CAMILLA_LINK]: [det.camillaRecordId],
            [detalleCamillaFields.ELEMENTO_LINK]: [det.elementoRecordId],
            [detalleCamillaFields.ESTADO_ELEMENTO]: det.estadoElemento,
            [detalleCamillaFields.CANTIDAD]: det.cantidad,
            [detalleCamillaFields.OBSERVACIONES]: det.observaciones,
          },
        }),
      })
    );

    await Promise.all(detallePromises);

    // 3. Crear registros de responsables
    const respUrl = getSGSSTUrl(airtableSGSSTConfig.respCamillaTableId);
    const respPromises = payload.responsables.map((resp) =>
      fetch(respUrl, {
        method: "POST",
        headers: getSGSSTHeaders(),
        body: JSON.stringify({
          fields: {
            [respCamillaFields.ID_FIRMA]: `RESP-${inspeccionId}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            [respCamillaFields.INSPECCION_LINK]: [cabeceraRecordId],
            [respCamillaFields.TIPO]: resp.tipo,
            [respCamillaFields.NOMBRE]: resp.nombre,
            [respCamillaFields.CARGO]: resp.cargo,
            [respCamillaFields.FIRMADO]: false,
          },
        }),
      })
    );

    await Promise.all(respPromises);

    return NextResponse.json({
      success: true,
      inspeccionId,
      recordId: cabeceraRecordId,
      message: "Inspección de camilla creada exitosamente",
    });
  } catch (error) {
    console.error("Error en POST inspecciones-camilla:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
