import { NextRequest, NextResponse } from "next/server";
import { verifyInspEquiposToken } from "@/lib/signingTokenInspEquipos";
import { guardarFirmaResponsable, obtenerInspeccionPendiente } from "@/lib/firmasTempStorage";

interface FirmarPublicoPayload {
  token: string;
  cedula: string;
  signatureData: string; // Base64 PNG de la firma
}

/**
 * POST /api/inspecciones-equipos/firmar-publico
 *
 * Procesa la firma del responsable via enlace público.
 * Guarda la firma en almacenamiento temporal (NO en Airtable).
 * La inspección se guardará en Airtable cuando el inspector confirme.
 */
export async function POST(request: NextRequest) {
  try {
    const body: FirmarPublicoPayload = await request.json();

    if (!body.token) {
      return NextResponse.json(
        { success: false, message: "Token requerido" },
        { status: 400 }
      );
    }
    if (!body.cedula) {
      return NextResponse.json(
        { success: false, message: "Número de documento requerido" },
        { status: 400 }
      );
    }
    if (!body.signatureData) {
      return NextResponse.json(
        { success: false, message: "Firma requerida" },
        { status: 400 }
      );
    }

    // Verificar token
    const payload = verifyInspEquiposToken(body.token);
    if (!payload) {
      return NextResponse.json(
        { success: false, message: "Token inválido o expirado" },
        { status: 401 }
      );
    }

    // Verificar que la cédula coincide EXACTAMENTE
    const cedulaToken = payload.c.replace(/\D/g, ""); // Solo números del token
    const cedulaIngresada = body.cedula.replace(/\D/g, ""); // Solo números ingresados

    if (cedulaToken !== cedulaIngresada) {
      return NextResponse.json(
        { success: false, message: "El número de documento no coincide con el registrado" },
        { status: 400 }
      );
    }

    // Verificar que existe la inspección pendiente en almacenamiento temporal
    const inspeccionPendiente = obtenerInspeccionPendiente(body.token);
    if (!inspeccionPendiente) {
      return NextResponse.json(
        { success: false, message: "La inspección ya no está disponible o expiró" },
        { status: 404 }
      );
    }

    // Guardar firma en almacenamiento temporal
    const firmaGuardada = guardarFirmaResponsable(body.token, {
      firma: body.signatureData,
      nombre: payload.n,
      cedula: cedulaIngresada,
      cargo: inspeccionPendiente.responsable.cargo || "Responsable de Área",
      area: payload.a,
      timestamp: new Date().toISOString(),
      metodo: "enlace_publico",
    });

    if (!firmaGuardada) {
      return NextResponse.json(
        { success: false, message: "Error al procesar la firma" },
        { status: 500 }
      );
    }

    console.log("Firma guardada temporalmente (pendiente de confirmación):", {
      area: payload.a,
      responsable: payload.n,
    });

    return NextResponse.json({
      success: true,
      message: "Firma registrada. El inspector debe confirmar para guardar la inspección.",
      data: {
        area: payload.a,
        nombreResponsable: payload.n,
        fechaFirma: new Date().toISOString(),
        // Indicador de que la firma está en memoria, no en BD
        pendienteConfirmacion: true,
      },
    });
  } catch (error) {
    console.error("Error en POST /api/inspecciones-equipos/firmar-publico:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
