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

interface KitDerramesItem {
  id: string;
  codigo: string;
  nombre: string;
  ubicacion: string;
  estado: string;
}

interface ElementoKit {
  id: string;
  codigo: string;
  nombre: string;
  cantidadEstandar: number;
  requiereVencimiento: boolean;
}

interface DetalleKitPayload {
  kitRecordId: string;
  elementoRecordId: string;
  estadoElemento: EstadoElemento;
  cantidad: number;
  fechaVencimiento?: string;
  observaciones: string;
}

interface VerificacionKitPayload {
  kitRecordId: string;
  conoceProcedimiento: boolean;
  almacenamientoAdecuado: boolean;
  rotuladoSenalizado: boolean;
}

interface ResponsablePayload {
  tipo: "Inspector" | "Responsable SG-SST" | "COPASST";
  nombre: string;
  cargo: string;
}

interface InspeccionKitPayload {
  fechaInspeccion: string;
  inspector: string;
  cargoInspector: string;
  observacionesGenerales: string;
  detalles: DetalleKitPayload[];
  verificaciones: VerificacionKitPayload[];
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
  return `INSPKIT-${y}${m}${d}-${rnd}`;
}

// ══════════════════════════════════════════════════════════
// GET /api/inspecciones-kit-derrames
// Lista inspecciones, kits y elementos
// ══════════════════════════════════════════════════════════
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const kits = searchParams.get("kits") === "true";
    const elementos = searchParams.get("elementos") === "true";

    if (kits) {
      // Cargar catálogo de kits de derrames
      const { kitsDerramesFields } = airtableSGSSTConfig;
      const url = getSGSSTUrl(airtableSGSSTConfig.kitsDerramesTableId);

      const params = new URLSearchParams({
        filterByFormula: `{${kitsDerramesFields.ESTADO}} = 'Activo'`,
        "sort[0][field]": kitsDerramesFields.CODIGO,
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
        console.error("Error cargando kits:", errorText);
        return NextResponse.json(
          { success: false, error: "Error al cargar kits de derrames" },
          { status: response.status }
        );
      }

      const data: AirtableResponse = await response.json();

      const items: KitDerramesItem[] = data.records.map((record) => ({
        id: record.id,
        codigo: (record.fields[kitsDerramesFields.CODIGO] as string) || "",
        nombre: (record.fields[kitsDerramesFields.NOMBRE] as string) || "",
        ubicacion: "", // Lookup
        estado: (record.fields[kitsDerramesFields.ESTADO] as string) || "",
      }));

      return NextResponse.json({ success: true, kits: items });
    }

    if (elementos) {
      // Cargar catálogo de elementos del kit
      const { elementosKitFields } = airtableSGSSTConfig;
      const url = getSGSSTUrl(airtableSGSSTConfig.elementosKitTableId);

      const params = new URLSearchParams({
        filterByFormula: `{${elementosKitFields.ESTADO}} = 'Activo'`,
        "sort[0][field]": elementosKitFields.NOMBRE,
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

      const items: ElementoKit[] = data.records.map((record) => ({
        id: record.id,
        codigo: (record.fields[elementosKitFields.CODIGO] as string) || "",
        nombre: (record.fields[elementosKitFields.NOMBRE] as string) || "",
        cantidadEstandar: (record.fields[elementosKitFields.CANTIDAD_ESTANDAR] as number) || 1,
        requiereVencimiento: (record.fields[elementosKitFields.REQUIERE_VENCIMIENTO] as boolean) || false,
      }));

      return NextResponse.json({ success: true, elementos: items });
    }

    // Listar inspecciones existentes
    const { inspKitDerramesFields } = airtableSGSSTConfig;
    const url = getSGSSTUrl(airtableSGSSTConfig.inspKitDerramesTableId);

    const params = new URLSearchParams({
      "sort[0][field]": inspKitDerramesFields.FECHA,
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
      idInspeccion: record.fields[inspKitDerramesFields.ID] as string,
      fecha: record.fields[inspKitDerramesFields.FECHA] as string,
      inspector: record.fields[inspKitDerramesFields.INSPECTOR] as string,
      estado: record.fields[inspKitDerramesFields.ESTADO] as string,
      observaciones: record.fields[inspKitDerramesFields.OBSERVACIONES] as string,
      urlDocumento: record.fields[inspKitDerramesFields.URL_DOCUMENTO] as string,
      detallesCount: ((record.fields[inspKitDerramesFields.DETALLE_LINK] as string[]) || []).length,
    }));

    return NextResponse.json({ success: true, inspecciones });
  } catch (error) {
    console.error("Error en GET inspecciones-kit-derrames:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-kit-derrames
// Crear nueva inspección de kit de derrames
// ══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const payload: InspeccionKitPayload = await request.json();

    const {
      inspKitDerramesFields,
      detalleKitDerramesFields,
      verificacionesKitFields,
      respKitDerramesFields,
    } = airtableSGSSTConfig;

    // 1. Crear registro de cabecera
    const inspeccionId = generateInspeccionId();
    const cabeceraUrl = getSGSSTUrl(airtableSGSSTConfig.inspKitDerramesTableId);

    const cabeceraResponse = await fetch(cabeceraUrl, {
      method: "POST",
      headers: getSGSSTHeaders(),
      body: JSON.stringify({
        fields: {
          [inspKitDerramesFields.ID]: inspeccionId,
          [inspKitDerramesFields.FECHA]: payload.fechaInspeccion,
          [inspKitDerramesFields.INSPECTOR]: payload.inspector,
          [inspKitDerramesFields.CARGO_INSPECTOR]: payload.cargoInspector,
          [inspKitDerramesFields.ESTADO]: "Borrador",
          [inspKitDerramesFields.OBSERVACIONES]: payload.observacionesGenerales,
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
    const detalleUrl = getSGSSTUrl(airtableSGSSTConfig.detalleKitDerramesTableId);
    const detallePromises = payload.detalles.map((det) =>
      fetch(detalleUrl, {
        method: "POST",
        headers: getSGSSTHeaders(),
        body: JSON.stringify({
          fields: {
            [detalleKitDerramesFields.ID]: `DET-${inspeccionId}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            [detalleKitDerramesFields.INSPECCION_LINK]: [cabeceraRecordId],
            [detalleKitDerramesFields.KIT_LINK]: [det.kitRecordId],
            [detalleKitDerramesFields.ELEMENTO_LINK]: [det.elementoRecordId],
            [detalleKitDerramesFields.ESTADO_ELEMENTO]: det.estadoElemento,
            [detalleKitDerramesFields.CANTIDAD]: det.cantidad,
            ...(det.fechaVencimiento && {
              [detalleKitDerramesFields.FECHA_VENCIMIENTO]: det.fechaVencimiento,
            }),
            [detalleKitDerramesFields.OBSERVACIONES]: det.observaciones,
          },
        }),
      })
    );

    await Promise.all(detallePromises);

    // 3. Crear registros de verificaciones
    const verUrl = getSGSSTUrl(airtableSGSSTConfig.verificacionesKitTableId);
    const verPromises = payload.verificaciones.map((ver) =>
      fetch(verUrl, {
        method: "POST",
        headers: getSGSSTHeaders(),
        body: JSON.stringify({
          fields: {
            [verificacionesKitFields.ID]: `VER-${inspeccionId}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            [verificacionesKitFields.INSPECCION_LINK]: [cabeceraRecordId],
            [verificacionesKitFields.KIT_LINK]: [ver.kitRecordId],
            [verificacionesKitFields.CONOCE_PROCEDIMIENTO]: ver.conoceProcedimiento,
            [verificacionesKitFields.ALMACENAMIENTO]: ver.almacenamientoAdecuado,
            [verificacionesKitFields.ROTULADO]: ver.rotuladoSenalizado,
          },
        }),
      })
    );

    await Promise.all(verPromises);

    // 4. Crear registros de responsables
    const respUrl = getSGSSTUrl(airtableSGSSTConfig.respKitDerramesTableId);
    const respPromises = payload.responsables.map((resp) =>
      fetch(respUrl, {
        method: "POST",
        headers: getSGSSTHeaders(),
        body: JSON.stringify({
          fields: {
            [respKitDerramesFields.ID_FIRMA]: `RESP-${inspeccionId}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`,
            [respKitDerramesFields.INSPECCION_LINK]: [cabeceraRecordId],
            [respKitDerramesFields.TIPO]: resp.tipo,
            [respKitDerramesFields.NOMBRE]: resp.nombre,
            [respKitDerramesFields.CARGO]: resp.cargo,
            [respKitDerramesFields.FIRMADO]: false,
          },
        }),
      })
    );

    await Promise.all(respPromises);

    return NextResponse.json({
      success: true,
      inspeccionId,
      recordId: cabeceraRecordId,
      message: "Inspección de kit de derrames creada exitosamente",
    });
  } catch (error) {
    console.error("Error en POST inspecciones-kit-derrames:", error);
    return NextResponse.json(
      { success: false, error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
