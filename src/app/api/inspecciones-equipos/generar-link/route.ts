import { NextRequest, NextResponse } from "next/server";
import { generateInspEquiposToken } from "@/lib/signingTokenInspEquipos";
import { guardarInspeccionPendiente } from "@/lib/firmasTempStorage";

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
  criteriosExtintorDetalle?: Record<string, { estado: string | null }> | null;
  elementosBotiquin?: Record<string, { estado: string | null; cantidad: string; fechaVencimiento: string }> | null;
  elementosKit?: Record<string, { estado: string | null; cantidad: string; fechaVencimiento: string }> | null;
  verificacionesKit?: Record<string, { respuesta: boolean | null }> | null;
  elementosCamilla?: Record<string, { estado: string | null }> | null;
  infoExtintor?: { claseAgente: string; tipoExtintor: string; capacidad: string; fechaProximaRecarga: string } | null;
}

interface ResponsablePayload {
  nombre: string;
  cedula: string;
  cargo: string;
}

interface FirmaGlobalPayload {
  nombre: string;
  cedula: string;
  cargo: string;
  firma: string;
}

interface GenerarLinkPayload {
  fechaInspeccion: string;
  inspector: string;
  area: string;
  observacionesGenerales: string;
  detalles: DetalleEquipoPayload[];
  responsable: ResponsablePayload;
  firmaSST?: FirmaGlobalPayload;
  firmaCOPASST?: FirmaGlobalPayload;
}

// ══════════════════════════════════════════════════════════
// POST /api/inspecciones-equipos/generar-link
// 
// Genera un enlace de firma SIN guardar en Airtable.
// Los datos se mantienen en memoria temporal hasta que
// el usuario decida guardar la inspección completa.
// ══════════════════════════════════════════════════════════
export async function POST(request: NextRequest) {
  try {
    const payload: GenerarLinkPayload = await request.json();

    // Validaciones
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
    if (!payload.area) {
      return NextResponse.json(
        { success: false, message: "El área es requerida" },
        { status: 400 }
      );
    }
    if (!payload.detalles || payload.detalles.length === 0) {
      return NextResponse.json(
        { success: false, message: "Debe incluir al menos un equipo inspeccionado" },
        { status: 400 }
      );
    }
    if (!payload.responsable || !payload.responsable.nombre || !payload.responsable.cedula) {
      return NextResponse.json(
        { success: false, message: "Los datos del responsable son requeridos" },
        { status: 400 }
      );
    }

    // Generar token de firma (válido por 72 horas)
    // El token contiene solo datos de identificación, no los detalles completos
    const token = generateInspEquiposToken({
      i: `TEMP-${Date.now()}`, // ID temporal (no es record de Airtable)
      r: `RESP-${payload.area.replace(/\s+/g, "")}`, // ID temporal del responsable
      a: payload.area,
      n: payload.responsable.nombre,
      c: payload.responsable.cedula,
      f: payload.fechaInspeccion,
    }, 72);

    // Guardar datos completos en almacenamiento temporal
    // Estos datos se usarán cuando se decida guardar la inspección
    guardarInspeccionPendiente(token, {
      fechaInspeccion: payload.fechaInspeccion,
      inspector: payload.inspector,
      area: payload.area,
      observacionesGenerales: payload.observacionesGenerales || "",
      detalles: payload.detalles,
      responsable: payload.responsable,
      firmaSST: payload.firmaSST,
      firmaCOPASST: payload.firmaCOPASST,
    });

    // Construir URL de firma
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const firmaUrl = `${baseUrl}/firmar/inspeccion-equipos?t=${encodeURIComponent(token)}`;

    console.log("Enlace de firma generado (sin guardar en BD):", {
      area: payload.area,
      responsable: payload.responsable.nombre,
      equipos: payload.detalles.length,
      tokenPreview: token.substring(0, 30) + "...",
    });

    return NextResponse.json({
      success: true,
      message: "Enlace de firma generado. La inspección se guardará cuando confirme.",
      data: {
        area: payload.area,
        responsable: payload.responsable.nombre,
        equiposIncluidos: payload.detalles.length,
        firmaUrl,
        token,
        expiracion: new Date(Date.now() + 72 * 3600000).toISOString(),
        guardadoEnBD: false,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-equipos/generar-link:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
