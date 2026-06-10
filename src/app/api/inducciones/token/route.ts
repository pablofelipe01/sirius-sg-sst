// ══════════════════════════════════════════════════════════
// API Route: /api/inducciones/token
// POST - Generar token de firma
// ══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { generarTokenFirma } from "@/core/use-cases/inducciones";

// POST /api/inducciones/token
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idInduccion, idEmpleadoCore } = body;

    if (!idInduccion) {
      return NextResponse.json(
        {
          success: false,
          message: "idInduccion es requerido",
        },
        { status: 400 }
      );
    }

    // Si no se proporciona idEmpleadoCore, lo obtenemos del registro
    let empleadoId = idEmpleadoCore;
    if (!empleadoId) {
      const { induccionesRepository } = await import("@/infrastructure/repositories/airtableInduccionesRepository");
      const registro = await induccionesRepository.obtenerRegistroPorIdInduccion(idInduccion);
      if (!registro) {
        return NextResponse.json(
          { success: false, message: "Inducción no encontrada" },
          { status: 404 }
        );
      }
      empleadoId = registro.idEmpleadoCore;
    }

    const token = await generarTokenFirma(idInduccion, empleadoId);

    return NextResponse.json({
      success: true,
      message: "Token generado exitosamente. El empleado puede usar este link para firmar y luego realizar su evaluación.",
      data: token,
    });
  } catch (error: any) {
    console.error("Error generando token:", error);
    return NextResponse.json(
      {
        success: false,
        message: error.message || "Error al generar token",
      },
      { status: 500 }
    );
  }
}
