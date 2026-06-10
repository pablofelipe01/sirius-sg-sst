// ══════════════════════════════════════════════════════════
// Use Case: Procesar Firma Digital
// Valida token, guarda firma en S3, actualiza registro
// ══════════════════════════════════════════════════════════

import crypto from "crypto";
import { induccionesRepository } from "@/infrastructure/repositories/airtableInduccionesRepository";
import type { RegistroInduccion } from "@/shared/types/inducciones";

// ── AES-256-CBC Encryption ──────────────────────────────
const AES_SECRET = process.env.AES_SIGNATURE_SECRET || "";

function encryptAES(plaintext: string): string {
  const key = crypto.createHash("sha256").update(AES_SECRET).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  return iv.toString("base64") + ":" + encrypted;
}

export async function procesarFirma(
  tokenJWT: string,
  firmaDataUrl: string
): Promise<RegistroInduccion> {
  if (!AES_SECRET) {
    throw new Error("Error de configuración del servidor");
  }

  // 1. Obtener y validar el token por hashFirma (JWT)
  const token = await induccionesRepository.obtenerTokenPorHash(tokenJWT);

  if (!token) {
    throw new Error("Token no encontrado");
  }

  if (token.estadoToken === "Usado") {
    throw new Error("Este token ya ha sido utilizado");
  }

  if (token.estadoToken === "Expirado") {
    throw new Error("Este token ha expirado");
  }

  // Verificar si el token expiró por tiempo
  const ahora = new Date();
  const expiracion = new Date(token.fechaExpiracion);

  if (ahora > expiracion) {
    // Marcar como expirado
    await induccionesRepository.actualizarToken(token.id!, { estadoToken: "Expirado" });
    throw new Error("Este token ha expirado");
  }

  // 2. Obtener el registro de inducción
  const registro = await induccionesRepository.obtenerRegistroPorIdInduccion(token.induccionId);

  if (!registro) {
    throw new Error("Inducción no encontrada");
  }

  // 3. Encriptar firma con AES-256-CBC
  const firmaPayload = JSON.stringify({
    signature: firmaDataUrl,
    employee: token.idEmpleadoCore,
    induccion: registro.idInduccion,
    nombre: registro.nombreEmpleado,
    timestamp: new Date().toISOString(),
    source: "remote-link",
  });
  const firmaEncriptada = encryptAES(firmaPayload);

  // 4. Actualizar token (marcar como usado)
  await induccionesRepository.actualizarToken(token.id!, {
    estadoToken: "Usado",
  });

  // 5. Actualizar registro de inducción con firma encriptada
  const registroActualizado = await induccionesRepository.actualizarRegistro(registro.id!, {
    firmaUrl: firmaEncriptada, // Ahora guarda la firma encriptada, no una URL
    estado: "Completada", // Pasa a completada tras la firma
  });

  return registroActualizado;
}
