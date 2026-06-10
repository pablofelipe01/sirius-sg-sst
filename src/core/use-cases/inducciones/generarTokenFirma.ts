// ══════════════════════════════════════════════════════════
// Use Case: Generar Token de Firma
// Genera un token temporal para firma digital
// ══════════════════════════════════════════════════════════

import { induccionesRepository } from "@/infrastructure/repositories/airtableInduccionesRepository";
import type { TokenFirma } from "@/shared/types/inducciones";

export async function generarTokenFirma(
  idInduccion: string,
  idEmpleadoCore: string
): Promise<TokenFirma> {
  // Verificar que la inducción existe
  const registro = await induccionesRepository.obtenerRegistroPorIdInduccion(idInduccion);

  if (!registro) {
    throw new Error("Inducción no encontrada");
  }

  // Si está en "En_Proceso", cambiar a "Pendiente_Firma"
  if (registro.estado === "En_Proceso") {
    await induccionesRepository.actualizarRegistro(registro.id!, {
      estado: "Pendiente_Firma",
    });
  } else if (registro.estado !== "Pendiente_Firma") {
    throw new Error(`La inducción ya está ${registro.estado}`);
  }

  // Generar el token
  const token = await induccionesRepository.crearTokenFirma(idInduccion, idEmpleadoCore);

  // Construir URL de firma
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const urlFirma = `${baseUrl}/inducciones/firma/${token.hashFirma}`;

  return {
    ...token,
    urlFirma,
  } as any;
}
