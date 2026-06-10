// ══════════════════════════════════════════════════════════
// API Route: /api/inducciones/token/[token]
// GET - Validar token y obtener datos de inducción (público)
// ══════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from "next/server";
import { induccionesRepository } from "@/infrastructure/repositories/airtableInduccionesRepository";

// GET /api/inducciones/token/[token]
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params;

    // 1. Buscar el token en la tabla de tokens (el hash es el JWT)
    const tokenRecord = await induccionesRepository.obtenerTokenPorHash(token);

    if (!tokenRecord) {
      return NextResponse.json(
        {
          success: false,
          message: "Token no encontrado",
        },
        { status: 404 }
      );
    }

    // 2. Validar estado del token
    if (tokenRecord.estadoToken === "Usado") {
      return NextResponse.json(
        {
          success: false,
          message: "Este token ya fue utilizado",
        },
        { status: 400 }
      );
    }

    if (tokenRecord.estadoToken === "Expirado") {
      return NextResponse.json(
        {
          success: false,
          message: "Este token ha expirado",
        },
        { status: 400 }
      );
    }

    // 3. Verificar fecha de expiración
    const now = new Date();
    const expiracion = new Date(tokenRecord.fechaExpiracion);

    if (now > expiracion) {
      // Marcar como expirado
      await induccionesRepository.actualizarToken(tokenRecord.id!, {
        estadoToken: "Expirado",
      });

      return NextResponse.json(
        {
          success: false,
          message: "Este token ha expirado",
        },
        { status: 400 }
      );
    }

    // 4. Obtener datos de la inducción
    const induccion = await induccionesRepository.obtenerRegistroPorIdInduccion(
      tokenRecord.induccionId
    );

    if (!induccion) {
      return NextResponse.json(
        {
          success: false,
          message: "Inducción no encontrada",
        },
        { status: 404 }
      );
    }

    // 5. Verificar que la inducción esté en estado "Pendiente_Firma"
    if (induccion.estado !== "Pendiente_Firma") {
      return NextResponse.json(
        {
          success: false,
          message: "Esta inducción ya fue firmada o no requiere firma",
        },
        { status: 400 }
      );
    }

    // 6. Buscar fecha de ingreso en tabla Nómina
    let fechaIngreso: string | undefined;
    try {
      const nominaBaseId = process.env.AIRTABLE_NOMINA_CORE_BASE_ID || process.env.AIRTABLE_BASE_ID;
      const nominaTableId = process.env.AIRTABLE_NOMINA_TABLE_ID;

      if (nominaBaseId && nominaTableId) {
        // Obtener todos los registros de nómina y buscar el que coincida
        // (ya que filterByFormula no funciona bien con campos linked)
        const nominaUrl = `https://api.airtable.com/v0/${nominaBaseId}/${nominaTableId}`;

        const nominaRes = await fetch(nominaUrl, {
          headers: {
            Authorization: `Bearer ${process.env.AIRTABLE_API_TOKEN}`,
          },
        });

        if (nominaRes.ok) {
          const nominaData = await nominaRes.json();
          // Buscar el registro que tenga el idEmpleadoCore
          const record = nominaData.records?.find((rec: any) =>
            rec.fields?.ID_Empleado?.includes(induccion.idEmpleadoCore)
          );
          if (record?.fields?.["Fecha Inicio Contrato"]) {
            fechaIngreso = record.fields["Fecha Inicio Contrato"];
          }
        }
      }
    } catch (err) {
      console.error("Error obteniendo fecha de ingreso:", err);
      // No fallar si no se puede obtener la fecha
    }

    // 7. Devolver datos necesarios para la firma
    return NextResponse.json({
      success: true,
      data: {
        idInduccion: induccion.idInduccion,
        idEmpleadoCore: induccion.idEmpleadoCore,
        nombreEmpleado: induccion.nombreEmpleado,
        numeroDocumento: induccion.numeroDocumento,
        cargo: induccion.cargo,
        tipo: induccion.tipo,
        fechaRealizacion: induccion.fechaRealizacion,
        responsableSST: induccion.responsableSST,
        fechaIngreso: fechaIngreso, // Fecha de Nómina
      },
    });
  } catch (error: any) {
    console.error("Error validando token:", error);
    return NextResponse.json(
      {
        success: false,
        message: "Error al validar el token",
        error: error.message,
      },
      { status: 500 }
    );
  }
}
