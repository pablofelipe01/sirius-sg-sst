/**
 * Utilidad de tokens HMAC-SHA256 para firma remota de inspecciones de equipos de emergencia.
 * No requiere base de datos — el token es auto-validante.
 */
import crypto from "crypto";

const AES_SECRET = process.env.AES_SIGNATURE_SECRET || "";

export interface InspEquiposTokenPayload {
  i: string;  // inspeccionRecordId (cabecera de inspección)
  r: string;  // responsableRecordId (registro de responsable)
  a: string;  // área
  n: string;  // nombre del responsable
  c: string;  // cédula del responsable
  f: string;  // fecha de inspección
  exp: number; // expiry timestamp (ms)
}

/** Genera un token firmado con HMAC-SHA256 válido por `horasValido` horas */
export function generateInspEquiposToken(
  payload: Omit<InspEquiposTokenPayload, "exp">,
  horasValido = 72
): string {
  const data: InspEquiposTokenPayload = {
    ...payload,
    exp: Date.now() + horasValido * 3_600_000,
  };
  const payloadB64 = Buffer.from(JSON.stringify(data)).toString("base64url");
  const sig = crypto
    .createHmac("sha256", AES_SECRET)
    .update(payloadB64)
    .digest("base64url")
    .substring(0, 20);
  return `${payloadB64}.${sig}`;
}

/** Valida el token. Retorna el payload o null si inválido/expirado. */
export function verifyInspEquiposToken(token: string): InspEquiposTokenPayload | null {
  try {
    const dotIdx = token.lastIndexOf(".");
    if (dotIdx === -1) return null;
    const payloadB64 = token.substring(0, dotIdx);
    const sig = token.substring(dotIdx + 1);

    const expectedSig = crypto
      .createHmac("sha256", AES_SECRET)
      .update(payloadB64)
      .digest("base64url")
      .substring(0, 20);

    if (sig !== expectedSig) return null;

    const data: InspEquiposTokenPayload = JSON.parse(
      Buffer.from(payloadB64, "base64url").toString("utf8")
    );
    if (data.exp < Date.now()) return null;

    return data;
  } catch {
    return null;
  }
}
