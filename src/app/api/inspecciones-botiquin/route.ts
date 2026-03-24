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

interface BotiquinItem {
  id: string;
  codigo: string;
  nombre: string;
  tipo: string;
  ubicacion: string;
  estado: string;
}

interface ElementoBotiquin {
  id: string;
  codigo: string;
  nombre: string;
  unidad: string;
  requiereVencimiento: boolean;
}

interface DetalleBotiquinPayload {
  botiquinRecordId: string;
  elementoRecordId: string;
  estadoElemento: EstadoElemento;
  cantidad: number;
  fechaVencimiento?: string;
  observaciones: string;
}

interface ResponsablePayload {
  tipo: "Inspector" | "Responsable SG-SST" | "COPASST";
  nombre: string;
  cargo: string;
}

interface InspeccionBotiquinPayload {
  fechaInspeccion: string;
  inspector: string;
  cargoInspector: string;
  observacionesGenerales: string;
  detalles: DetalleBotiquinPayload[];
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
  return `INSPBOT-${y}${m}${d}-${rnd}`;
}

// ══════════════════════════════════════════════════════════
// GET /api/inspecciones-botiquin
// Lista inspecciones, botiquines y elementos
// ══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const botiquines = searchParams.get("botiquines") === "true";
    const elementos = searchParams.get("elementos") === "true";

    if (botiquines) {
      // Cargar catálogo de botiquines
      const { botiquinesFields } = airtableSGSSTConfig;
      const url = getSGSSTUrl(airtableSGSSTConfig.botiquinesTableId);

      const params = new URLSearchParams({
        filterByFormula: `{${botiquinesFields.ESTADO}} = 'Activo'`,
        "sort[0][field]": botiquinesFields.CODIGO,
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
        console.error("Error cargando botiquines:", errorText);
        return NextResponse.json(
          { success: false, error: "Error al cargar botiquines" },
          { status: response.status }
        );
      }

      const data: AirtableResponse = await response.json();

      const items: BotiquinItem[] = data.records.map((record) => ({
        id: record.id,
        codigo: (record.fields[botiquinesFields.CODIGO] as string) || "",
        nombre: (record.fields[botiquinesFields.NOMBRE] as string) || "",
        tipo: "", // Lookup
        ubicacion: "", // Lookup
        estado: (record.fields[botiquinesFields.ESTADO] as string) || "",
      }));

      return NextResponse.json({ success: true, botiquines: items });
    }

    if (elementos) {
      // Cargar catálogo de elementos de botiquín
      const { elementosBotiquinFields } = airtableSGSSTConfig;
      const url = getSGSSTUrl(airtableSGSSTConfig.elementosBotiquinTableId);

      const params = new URLSearchParams({
        filterByFormula: `{${elementosBotiquinFields.ESTADO}} = 'Activo'`,
        "sort[0][field]": elementosBotiquinFields.NOMBRE,
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

      const items: ElementoBotiquin[] = data.records.map((record) => ({
        id: record.id,
        codigo: (record.fields[elementosBotiquinFields.CODIGO] as string) || "",
        nombre: (record.fields[elementosBotiquinFields.NOMBRE] as string) || "",
        unidad: (record.fields[elementosBotiquinFields.UNIDAD] as string) || "",
        requiereVencimiento: (record.fields[elementosBotiquinFields.REQUIERE_VENCIMIENTO] as boolean) || false,
      }));

      return NextResponse.json({ success: true, elementos: items });
    }

    // Listar inspecciones existentes
    const { inspBotiquinFields } = airtableSGSSTConfig;
    const url = getSGSSTUrl(airtableSGSSTConfig.inspBotiquinTableId);

    const params = new URLSearchParams({
      "sort[0][field]": inspBotiquinFields.FECHA,
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
      idInspeccion: record.fields[inspBotiquinFields.ID] as string,
      fecha: record.fields[inspBotiquinFields.FECHA] as string,
      inspector: record.fields[inspBotiquinFields.INSPECTOR] as string,
      estado: record.fields[inspBotiquinFields.ESTADO] as string,
      observaciones: record.fields[inspBotiquinFields.OBSERVACIONES] as string,
      urlDocumento: record.fields[inspBotiquinFields.URL_DOCUMENTO] as string,
      detallesCount: ((record.fields[inspBotiquinFields.DETALLE_LINK] as string[]) || []).length,
    }));

    return NextResponse.json({ success: true, inspecciones });
  } catch (error) {
    console.error("Error en GET inspecciones-botiquin:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-botiquin
// Crear nueva inspección de botiquín
// ══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const payload: InspeccionBotiquinPayload = await request.json();

    const {
      inspBotiquinFields,
      detalleBotiquinFields,
      respBotiquinFields,
    } = airtableSGSSTConfig;

    // 1. Crear registro de cabecera
    const inspeccionId = generateInspeccionId();
    const cabeceraUrl = getSGSSTUrl(airtableSGSSTConfig.inspBotiquinTableId);

    const cabeceraResponse = await fetch(cabeceraUrl, {
      method: "POST",
      headers: getSGSSTHeaders(),
      body: JSON.stringify({
        fields: {
          [inspBotiquinFields.ID]: inspeccionId,
          [inspBotiquinFields.FECHA]: payload.fechaInspeccion,
          [inspBotiquinFields.INSPECTOR]: payload.inspector,
          [inspBotiquinFields.CARGO_INSPECTOR]: payload.cargoInspector,
          [inspBotiquinFields.ESTADO]: "Borrador",
          [inspBotiquinFields.OBSERVACIONES]: payload.observacionesGenerales,
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
    const detalleUrl = getSGSSTUrl(airtableSGSSTConfig.detalleBotiquinTableId);
    const detallePromises = payload.detalles.map((det) =>
      fetch(detalleUrl, {
        method: "POST",
        headers: getSGSSTHeaders(),
        body: JSON.stringify({
          fields: {
            [detalleBotiquinFields.ID]: `DET-${inspeccionId}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            [detalleBotiquinFields.INSPECCION_LINK]: [cabeceraRecordId],
            [detalleBotiquinFields.BOTIQUIN_LINK]: [det.botiquinRecordId],
            [detalleBotiquinFields.ELEMENTO_LINK]: [det.elementoRecordId],
            [detalleBotiquinFields.ESTADO_ELEMENTO]: det.estadoElemento,
            [detalleBotiquinFields.CANTIDAD]: det.cantidad,
            ...(det.fechaVencimiento && {
              [detalleBotiquinFields.FECHA_VENCIMIENTO]: det.fechaVencimiento,
            }),
            [detalleBotiquinFields.OBSERVACIONES]: det.observaciones,
          },
        }),
      })
    );

    await Promise.all(detallePromises);

    // 3. Crear registros de responsables
    const respUrl = getSGSSTUrl(airtableSGSSTConfig.respBotiquinTableId);
    const respPromises = payload.responsables.map((resp) =>
      fetch(respUrl, {
        method: "POST",
        headers: getSGSSTHeaders(),
        body: JSON.stringify({
          fields: {
            [respBotiquinFields.ID_FIRMA]: `RESP-${inspeccionId}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            [respBotiquinFields.INSPECCION_LINK]: [cabeceraRecordId],
            [respBotiquinFields.TIPO]: resp.tipo,
            [respBotiquinFields.NOMBRE]: resp.nombre,
            [respBotiquinFields.CARGO]: resp.cargo,
            [respBotiquinFields.FIRMADO]: false,
          },
        }),
      })
    );

    await Promise.all(respPromises);

    return NextResponse.json({
      success: true,
      inspeccionId,
      recordId: cabeceraRecordId,
      message: "Inspección de botiquín creada exitosamente",
    });
  } catch (error) {
    console.error("Error en POST inspecciones-botiquin:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
