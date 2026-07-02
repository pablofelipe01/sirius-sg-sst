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

  console.log(`[generarTokenFirma] ID: ${idInduccion}, Estado actual: ${registro.estado}, Firma URL: ${registro.firmaUrl ? 'SÍ' : 'NO'}`);

  // Si está en "En_Proceso", cambiar a "Pendiente_Firma"
  if (registro.estado === "En_Proceso") {
    console.log(`[generarTokenFirma] Cambiando estado de "En_Proceso" a "Pendiente_Firma"`);
    await induccionesRepository.actualizarRegistro(registro.id!, {
      estado: "Pendiente_Firma",
    });
  } else if (registro.estado !== "Pendiente_Firma") {
    console.error(`[generarTokenFirma] ERROR - Estado no permitido: "${registro.estado}". Solo se permite "En_Proceso" o "Pendiente_Firma"`);
    throw new Error(`La inducción ya está ${registro.estado}`);
  }

  // Generar el token
  const token = await induccionesRepository.crearTokenFirma(idInduccion, idEmpleadoCore);

  // Validar que hashFirma exista
  if (!token.hashFirma) {
    console.error('[generarTokenFirma] ERROR - hashFirma es null o undefined');
    throw new Error('Error generando hash de firma - token inválido');
  }

  // Validar variable de entorno
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
  if (!baseUrl) {
    console.error('[generarTokenFirma] ERROR - NEXT_PUBLIC_APP_URL no está definida');
    console.error('[generarTokenFirma] Usando fallback: http://localhost:3000');
    // En desarrollo, usar localhost; en producción esto debe estar configurado
    const fallbackUrl = process.env.NODE_ENV === 'development'
      ? 'http://localhost:3000'
      : 'https://sirius-sg-sst.vercel.app';

    const urlFirma = `${fallbackUrl}/inducciones/firma/${token.hashFirma}`;
    console.warn(`[generarTokenFirma] URL generada con fallback: ${urlFirma}`);

    return {
      ...token,
      urlFirma,
    } as any;
  }

  // Construir URL de firma
  const urlFirma = `${baseUrl}/inducciones/firma/${token.hashFirma}`;
  console.log(`[generarTokenFirma] URL generada correctamente: ${urlFirma}`);

  return {
    ...token,
    urlFirma,
  } as any;
}
