import { NextRequest, NextResponse } from "next/server";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
type EstadoCriterio = "Bueno" | "Regular" | "Malo" | "NA" | null;

interface ExtintorItem {
  id: string;
  codigo: string;
  numero: number;
  nombre: string;
  tipo: string;
  capacidad: string;
  claseAgente: string[];
  ubicacion: string;
  fechaRecarga: string | null;
  estado: string;
}

interface DetalleExtintorPayload {
  extintorRecordId: string;
  presion: EstadoCriterio;
  selloGarantia: EstadoCriterio;
  manometro: EstadoCriterio;
  estadoCilindro: EstadoCriterio;
  manija: EstadoCriterio;
  boquillaManguera: EstadoCriterio;
  anilloSeguridad: EstadoCriterio;
  pinSeguridad: EstadoCriterio;
  pintura: EstadoCriterio;
  tarjetaInspeccion: EstadoCriterio;
  observaciones: string;
}

interface ResponsablePayload {
  tipo: "Inspector" | "Responsable SG-SST" | "COPASST";
  nombre: string;
  cargo: string;
}

interface InspeccionExtintorPayload {
  fechaInspeccion: string;
  inspector: string;
  cargoInspector: string;
  observacionesGenerales: string;
  detalles: DetalleExtintorPayload[];
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
  return `INSPEXT-${y}${m}${d}-${rnd}`;
}

// ══════════════════════════════════════════════════════════
// GET /api/inspecciones-extintor
// Lista inspecciones y extintores
// ══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const extintores = searchParams.get("extintores") === "true";

    if (extintores) {
      // Cargar catálogo de extintores
      const { extintoresFields } = airtableSGSSTConfig;
      const url = getSGSSTUrl(airtableSGSSTConfig.extintoresTableId);

      const params = new URLSearchParams({
        filterByFormula: `{${extintoresFields.ESTADO}} = 'Activo'`,
        "sort[0][field]": extintoresFields.NUMERO,
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
        console.error("Error cargando extintores:", errorText);
        return NextResponse.json(
          { success: false, error: "Error al cargar extintores" },
          { status: response.status }
        );
      }

      const data: AirtableResponse = await response.json();

      const items: ExtintorItem[] = data.records.map((record) => ({
        id: record.id,
        codigo: (record.fields[extintoresFields.CODIGO] as string) || "",
        numero: (record.fields[extintoresFields.NUMERO] as number) || 0,
        nombre: (record.fields[extintoresFields.NOMBRE] as string) || "",
        tipo: "", // Lookup - se resuelve por separado si es necesario
        capacidad: (record.fields[extintoresFields.CAPACIDAD] as string) || "",
        claseAgente: (record.fields[extintoresFields.CLASE_AGENTE] as string[]) || [],
        ubicacion: "", // Lookup - se resuelve por separado
        fechaRecarga: (record.fields[extintoresFields.FECHA_RECARGA] as string) || null,
        estado: (record.fields[extintoresFields.ESTADO] as string) || "",
      }));

      return NextResponse.json({ success: true, extintores: items });
    }

    // Listar inspecciones existentes
    const { inspExtintorFields } = airtableSGSSTConfig;
    const url = getSGSSTUrl(airtableSGSSTConfig.inspExtintorTableId);

    const params = new URLSearchParams({
      "sort[0][field]": inspExtintorFields.FECHA,
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
      idInspeccion: record.fields[inspExtintorFields.ID] as string,
      fecha: record.fields[inspExtintorFields.FECHA] as string,
      inspector: record.fields[inspExtintorFields.INSPECTOR] as string,
      estado: record.fields[inspExtintorFields.ESTADO] as string,
      observaciones: record.fields[inspExtintorFields.OBSERVACIONES] as string,
      urlDocumento: record.fields[inspExtintorFields.URL_DOCUMENTO] as string,
      detallesCount: ((record.fields[inspExtintorFields.DETALLE_LINK] as string[]) || []).length,
    }));

    return NextResponse.json({ success: true, inspecciones });
  } catch (error) {
    console.error("Error en GET inspecciones-extintor:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-extintor
// Crear nueva inspección de extintores
// ══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const payload: InspeccionExtintorPayload = await request.json();

    const {
      inspExtintorFields,
      detalleExtintorFields,
      respExtintorFields,
    } = airtableSGSSTConfig;

    // 1. Crear registro de cabecera
    const inspeccionId = generateInspeccionId();
    const cabeceraUrl = getSGSSTUrl(airtableSGSSTConfig.inspExtintorTableId);

    const cabeceraResponse = await fetch(cabeceraUrl, {
      method: "POST",
      headers: getSGSSTHeaders(),
      body: JSON.stringify({
        fields: {
          [inspExtintorFields.ID]: inspeccionId,
          [inspExtintorFields.FECHA]: payload.fechaInspeccion,
          [inspExtintorFields.INSPECTOR]: payload.inspector,
          [inspExtintorFields.CARGO_INSPECTOR]: payload.cargoInspector,
          [inspExtintorFields.ESTADO]: "Borrador",
          [inspExtintorFields.OBSERVACIONES]: payload.observacionesGenerales,
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
    const detalleUrl = getSGSSTUrl(airtableSGSSTConfig.detalleExtintorTableId);
    const detallePromises = payload.detalles.map((det) =>
      fetch(detalleUrl, {
        method: "POST",
        headers: getSGSSTHeaders(),
        body: JSON.stringify({
          fields: {
            [detalleExtintorFields.ID]: `DET-${inspeccionId}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            [detalleExtintorFields.INSPECCION_LINK]: [cabeceraRecordId],
            [detalleExtintorFields.EXTINTOR_LINK]: [det.extintorRecordId],
            [detalleExtintorFields.PRESION]: det.presion,
            [detalleExtintorFields.SELLO_GARANTIA]: det.selloGarantia,
            [detalleExtintorFields.MANOMETRO]: det.manometro,
            [detalleExtintorFields.ESTADO_CILINDRO]: det.estadoCilindro,
            [detalleExtintorFields.MANIJA]: det.manija,
            [detalleExtintorFields.BOQUILLA_MANGUERA]: det.boquillaManguera,
            [detalleExtintorFields.ANILLO_SEGURIDAD]: det.anilloSeguridad,
            [detalleExtintorFields.PIN_SEGURIDAD]: det.pinSeguridad,
            [detalleExtintorFields.PINTURA]: det.pintura,
            [detalleExtintorFields.TARJETA_INSPECCION]: det.tarjetaInspeccion,
            [detalleExtintorFields.OBSERVACIONES]: det.observaciones,
          },
        }),
      })
    );

    await Promise.all(detallePromises);

    // 3. Crear registros de responsables
    const respUrl = getSGSSTUrl(airtableSGSSTConfig.respExtintorTableId);
    const respPromises = payload.responsables.map((resp) =>
      fetch(respUrl, {
        method: "POST",
        headers: getSGSSTHeaders(),
        body: JSON.stringify({
          fields: {
            [respExtintorFields.ID_FIRMA]: `RESP-${inspeccionId}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            [respExtintorFields.INSPECCION_LINK]: [cabeceraRecordId],
            [respExtintorFields.TIPO]: resp.tipo,
            [respExtintorFields.NOMBRE]: resp.nombre,
            [respExtintorFields.CARGO]: resp.cargo,
            [respExtintorFields.FIRMADO]: false,
          },
        }),
      })
    );

    await Promise.all(respPromises);

    return NextResponse.json({
      success: true,
      inspeccionId,
      recordId: cabeceraRecordId,
      message: "Inspección de extintores creada exitosamente",
    });
  } catch (error) {
    console.error("Error en POST inspecciones-extintor:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
