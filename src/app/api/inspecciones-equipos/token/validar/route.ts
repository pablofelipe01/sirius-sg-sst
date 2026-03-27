import { NextRequest, NextResponse } from "next/server";
import { verifyInspEquiposToken } from "@/lib/signingTokenInspEquipos";
import { obtenerInspeccionPendiente, verificarFirmaResponsable } from "@/lib/firmasTempStorage";

/**
 * GET /api/inspecciones-equipos/token/validar?t=TOKEN
 *
 * Valida el token de firma y devuelve información de la inspección.
 * Lee desde almacenamiento temporal (NO desde Airtable).
 * NO requiere autenticación JWT (público).
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("t");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Token requerido" },
        { status: 400 }
      );
    }

    // Verificar token HMAC
    const payload = verifyInspEquiposToken(token);
    if (!payload) {
      return NextResponse.json(
        { success: false, message: "Token inválido o expirado" },
        { status: 401 }
      );
    }

    // Obtener datos de la inspección desde almacenamiento temporal
    const inspeccionPendiente = obtenerInspeccionPendiente(token);
    if (!inspeccionPendiente) {
      return NextResponse.json(
        { success: false, message: "La inspección ya no está disponible o expiró" },
        { status: 404 }
      );
    }

    // Verificar si el responsable ya firmó (en almacenamiento temporal)
    const firmaResponsable = verificarFirmaResponsable(token);
    const yaFirmado = firmaResponsable !== null;

    // Preparar lista de equipos desde los detalles guardados
    const equipos = (inspeccionPendiente.detalles as Array<{
      codigoEquipo: string;
      nombreEquipo: string;
      categoria: string;
      estadoGeneral: string;
    }>).map((det) => ({
      codigo: det.codigoEquipo,
      nombre: det.nombreEquipo,
      categoria: det.categoria,
      estadoGeneral: det.estadoGeneral || "",
    }));

    // Ocultar parte del documento (mostrar solo últimos 4 dígitos)
    const cedula = payload.c;
    const documentoMascara = cedula.length > 4
      ? "****" + cedula.slice(-4)
      : cedula;

    console.log("Validación token (memoria temporal):", {
      area: payload.a,
      nombre: payload.n,
      yaFirmado,
      equipos: equipos.length,
    });

    return NextResponse.json({
      success: true,
      data: {
        tokenValido: true,
        fechaInspeccion: inspeccionPendiente.fechaInspeccion,
        inspector: inspeccionPendiente.inspector,
        area: payload.a,
        nombreResponsable: payload.n,
        documentoMascara,
        cargo: inspeccionPendiente.responsable.cargo || "Responsable de Área",
        estado: yaFirmado ? "Firmado" : "Pendiente",
        yaFirmado,
        equipos,
        totalEquipos: equipos.length,
        fechaExpiracion: new Date(payload.exp).toISOString(),
        // Indicador de que los datos están en memoria, no en BD
        pendienteGuardar: true,
        // Si ya firmó, incluir la firma para que el frontend la use
        firmaData: firmaResponsable ? {
          firma: firmaResponsable.firma,
          fechaFirma: firmaResponsable.timestamp,
        } : null,
      },
    });
  } catch (error) {
    console.error("Error en GET /api/inspecciones-equipos/token/validar:", error);
    return NextResponse.json(
      { success: false, message: "Error al validar el token" },
      { status: 500 }
    );
  }
}
