import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";

// ══════════════════════════════════════════════════════════
// AES-256-CBC Encryption
// ══════════════════════════════════════════════════════════
const AES_SECRET = process.env.AES_SIGNATURE_SECRET || "";

function encryptAES(plaintext: string): string {
  const key = crypto.createHash("sha256").update(AES_SECRET).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  return iv.toString("base64") + ":" + encrypted;
}

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
type CondicionEquipo = "Bueno" | "Malo" | "NA" | null;

interface DetalleEquipoPayload {
  equipoRecordId: string;
  codigoEquipo: string;
  nombreEquipo: string;
  categoria: string;
  area: string;
  estadoGeneral: CondicionEquipo;
  senalizacion: CondicionEquipo;
  accesibilidad: CondicionEquipo;
  presionManometro: CondicionEquipo;
  manguera: CondicionEquipo;
  pinSeguridad: CondicionEquipo;
  soporteBase: CondicionEquipo;
  completitudElementos: CondicionEquipo;
  estadoContenedor: CondicionEquipo;
  estructura: CondicionEquipo;
  correasArnes: CondicionEquipo;
  fechaVencimiento: string | null;
  observaciones: string;
}

interface ResponsablePayload {
  tipo: "Responsable Área" | "Responsable SST" | "Responsable COPASST";
  area?: string | null;
  nombre: string;
  cedula: string;
  cargo: string;
  firma: string; // Base64 data URL
}

interface InspeccionEquiposPayload {
  fechaInspeccion: string;
  inspector: string;
  observacionesGenerales: string;
  detalles: DetalleEquipoPayload[];
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
  return `INSPEQ-${y}${m}${d}-${rnd}`;
}

// ══════════════════════════════════════════════════════════
// GET /api/inspecciones-equipos
// Lista las inspecciones de equipos de emergencia
// ══════════════════════════════════════════════════════════
export async function GET() {
  try {
    const { inspEquiposFields } = airtableSGSSTConfig;
    const url = getSGSSTUrl(airtableSGSSTConfig.inspEquiposTableId);

    const params = new URLSearchParams({
      "sort[0][field]": inspEquiposFields.FECHA,
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
      console.error("Error listando inspecciones equipos:", errorText);
      return NextResponse.json(
        { success: false, message: "Error al consultar inspecciones" },
        { status: 500 }
      );
    }

    const data: AirtableResponse = await response.json();

    const inspecciones = data.records.map((record) => ({
      id: record.id,
      idInspeccion: record.fields[inspEquiposFields.ID] as string,
      fecha: record.fields[inspEquiposFields.FECHA] as string,
      inspector: record.fields[inspEquiposFields.INSPECTOR] as string,
      estado: record.fields[inspEquiposFields.ESTADO] as string,
      observaciones: (record.fields[inspEquiposFields.OBSERVACIONES] as string) || "",
    }));

    return NextResponse.json({
      success: true,
      data: inspecciones,
      total: inspecciones.length,
    });
  } catch (error) {
    console.error("Error en GET /api/inspecciones-equipos:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-equipos
// Guarda una inspección de equipos de emergencia
// ══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const payload: InspeccionEquiposPayload = await request.json();

    if (!payload.fechaInspeccion) {
      return NextResponse.json(
        { success: false, message: "La fecha de inspección es requerida" },
        { status: 400 }
      );
    }
    if (!payload.inspector) {
      return NextResponse.json(
        { success: false, message: "El inspector es requerido" },
        { status: 400 }
      );
    }
    if (!payload.detalles || payload.detalles.length === 0) {
      return NextResponse.json(
        { success: false, message: "Debe incluir al menos un equipo inspeccionado" },
        { status: 400 }
      );
    }

    const {
      inspEquiposFields,
      detalleEquiposFields,
      respEquiposFields,
    } = airtableSGSSTConfig;

    const inspeccionId = generateInspeccionId();

    console.log("Creando inspección equipos:", {
      id: inspeccionId,
      fecha: payload.fechaInspeccion,
      inspector: payload.inspector,
      cantidadEquipos: payload.detalles.length,
    });

    // 1. Crear cabecera
    const cabeceraUrl = getSGSSTUrl(airtableSGSSTConfig.inspEquiposTableId);
    const cabeceraResponse = await fetch(cabeceraUrl, {
      method: "POST",
      headers: getSGSSTHeaders(),
      body: JSON.stringify({
        records: [
          {
            fields: {
              [inspEquiposFields.ID]: inspeccionId,
              [inspEquiposFields.FECHA]: payload.fechaInspeccion,
              [inspEquiposFields.INSPECTOR]: payload.inspector,
              [inspEquiposFields.ESTADO]: "Completada",
              [inspEquiposFields.OBSERVACIONES]: payload.observacionesGenerales || "",
            },
          },
        ],
      }),
    });

    if (!cabeceraResponse.ok) {
      const errorText = await cabeceraResponse.text();
      console.error("Error creando cabecera:", errorText);
      return NextResponse.json(
        { success: false, message: "Error al crear la inspección" },
        { status: 500 }
      );
    }

    const cabeceraData: AirtableResponse = await cabeceraResponse.json();
    const cabeceraRecordId = cabeceraData.records[0].id;

    // 2. Crear detalles (lotes de 10)
    const detalleUrl = getSGSSTUrl(airtableSGSSTConfig.detalleEquiposTableId);
    const detalleRecords = payload.detalles.map((det) => {
      const fields: Record<string, unknown> = {
        [detalleEquiposFields.ID]: `${inspeccionId}-${det.codigoEquipo}`,
        [detalleEquiposFields.INSPECCION_LINK]: [cabeceraRecordId],
        [detalleEquiposFields.EQUIPO_LINK]: [det.equipoRecordId],
        [detalleEquiposFields.CATEGORIA]: det.categoria,
        [detalleEquiposFields.AREA]: det.area,
        [detalleEquiposFields.OBSERVACIONES]: det.observaciones || "",
      };

      // Criterios comunes
      if (det.estadoGeneral) fields[detalleEquiposFields.ESTADO_GENERAL] = det.estadoGeneral;
      if (det.senalizacion) fields[detalleEquiposFields.SENALIZACION] = det.senalizacion;
      if (det.accesibilidad) fields[detalleEquiposFields.ACCESIBILIDAD] = det.accesibilidad;

      // Criterios Extintor
      if (det.presionManometro) fields[detalleEquiposFields.PRESION_MANOMETRO] = det.presionManometro;
      if (det.manguera) fields[detalleEquiposFields.MANGUERA] = det.manguera;
      if (det.pinSeguridad) fields[detalleEquiposFields.PIN_SEGURIDAD] = det.pinSeguridad;
      if (det.soporteBase) fields[detalleEquiposFields.SOPORTE_BASE] = det.soporteBase;

      // Criterios Botiquín / Kit
      if (det.completitudElementos) fields[detalleEquiposFields.COMPLETITUD] = det.completitudElementos;
      if (det.estadoContenedor) fields[detalleEquiposFields.ESTADO_CONTENEDOR] = det.estadoContenedor;

      // Criterios Camilla
      if (det.estructura) fields[detalleEquiposFields.ESTRUCTURA] = det.estructura;
      if (det.correasArnes) fields[detalleEquiposFields.CORREAS] = det.correasArnes;

      // Fecha vencimiento
      if (det.fechaVencimiento) fields[detalleEquiposFields.FECHA_VENCIMIENTO] = det.fechaVencimiento;

      return { fields };
    });

    const createdDetalleIds: string[] = [];
    for (let i = 0; i < detalleRecords.length; i += 10) {
      const batch = detalleRecords.slice(i, i + 10);
      const resp = await fetch(detalleUrl, {
        method: "POST",
        headers: getSGSSTHeaders(),
        body: JSON.stringify({ records: batch }),
      });
      if (resp.ok) {
        const data: AirtableResponse = await resp.json();
        createdDetalleIds.push(...data.records.map((r) => r.id));
      } else {
        console.error("Error creando detalles:", await resp.text());
      }
    }

    // 3. Crear responsables (firmas)
    const respUrl = getSGSSTUrl(airtableSGSSTConfig.respEquiposTableId);
    const respRecords = payload.responsables.map((r, idx) => {
      let firmaEncriptada = "";
      if (r.firma && AES_SECRET) {
        firmaEncriptada = encryptAES(
          JSON.stringify({
            signature: r.firma,
            nombre: r.nombre,
            cedula: r.cedula,
            tipo: r.tipo,
            area: r.area || null,
            timestamp: new Date().toISOString(),
            inspeccionId,
          })
        );
      }

      // Generar ID único basado en tipo y área (o índice)
      const tipoCorto = r.tipo === "Responsable Área" ? "AREA" :
                        r.tipo === "Responsable SST" ? "SST" : "COPASST";
      const areaSuffix = r.area ? `-${r.area.replace(/\s+/g, "")}` : "";
      const idSuffix = r.tipo === "Responsable Área" ? areaSuffix : `-${idx}`;

      return {
        fields: {
          [respEquiposFields.ID_FIRMA]: `${inspeccionId}-${tipoCorto}${idSuffix}`,
          [respEquiposFields.INSPECCION_LINK]: [cabeceraRecordId],
          [respEquiposFields.TIPO]: r.tipo,
          [respEquiposFields.NOMBRE]: r.nombre,
          [respEquiposFields.CEDULA]: r.cedula,
          [respEquiposFields.CARGO]: r.cargo,
          [respEquiposFields.FIRMA]: firmaEncriptada,
          [respEquiposFields.FECHA_FIRMA]: new Date().toISOString(),
        },
      };
    });

    if (respRecords.length > 0) {
      const respResponse = await fetch(respUrl, {
        method: "POST",
        headers: getSGSSTHeaders(),
        body: JSON.stringify({ records: respRecords }),
      });
      if (!respResponse.ok) {
        console.error("Error creando responsables:", await respResponse.text());
      }
    }

    console.log("Inspección equipos guardada:", {
      id: inspeccionId,
      recordId: cabeceraRecordId,
      detalles: createdDetalleIds.length,
      responsables: respRecords.length,
    });

    return NextResponse.json({
      success: true,
      message: "Inspección de equipos registrada correctamente",
      data: {
        id: inspeccionId,
        recordId: cabeceraRecordId,
        fecha: payload.fechaInspeccion,
        equiposInspeccionados: createdDetalleIds.length,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-equipos:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
