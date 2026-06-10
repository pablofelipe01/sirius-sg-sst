// ══════════════════════════════════════════════════════════
// API Route: /api/inducciones/certificado
// POST - Generar certificado PDF para una inducción
// ══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { generarCertificado } from "@/core/use-cases/inducciones";

// POST /api/inducciones/certificado
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { idInduccion } = body;

    if (!idInduccion) {
      return NextResponse.json(
        {
          success: false,
          message: "ID de inducción requerido",
        },
        { status: 400 }
      );
    }

    // Generar el certificado
    const { certificadoUrl, registro } = await generarCertificado(idInduccion);

    return NextResponse.json({
      success: true,
      message: "Certificado generado exitosamente",
      data: {
        certificadoUrl,
        registro,
      },
    });
  } catch (error: any) {
    console.error("Error generando certificado:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Error al generar certificado",
      },
      { status: 500 }
    );
  }
}
