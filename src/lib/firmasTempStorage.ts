/**
 * Almacenamiento temporal en memoria para firmas pendientes.
 * Las firmas se guardan aquí hasta que el usuario decide guardar la inspección.
 * 
 * NOTA: En producción con múltiples instancias, considerar Redis o similar.
 * Para el servidor de desarrollo y single-instance, esto funciona correctamente.
 */

interface FirmaTemporalData {
  firma: string; // Base64 data URL
  nombre: string;
  cedula: string;
  cargo: string;
  area: string;
  timestamp: string;
  metodo: "enlace_publico";
}

interface TokenData {
  // Datos de la inspección (NO guardados en Airtable aún)
  fechaInspeccion: string;
  inspector: string;
  area: string;
  observacionesGenerales: string;
  detalles: unknown[]; // Los detalles de equipos
  responsable: {
    nombre: string;
    cedula: string;
    cargo: string;
  };
  firmaSST?: {
    nombre: string;
    cedula: string;
    cargo: string;
    firma: string;
  };
  firmaCOPASST?: {
    nombre: string;
    cedula: string;
    cargo: string;
    firma: string;
  };
  // La firma del responsable de área (cuando firme remotamente)
  firmaResponsable?: FirmaTemporalData;
  // Timestamp de creación para limpieza
  createdAt: number;
}

// Tiempo de expiración: 72 horas (igual que el token)
const EXPIRATION_MS = 72 * 60 * 60 * 1000;

// Declaración para TypeScript del objeto global
declare global {
  // eslint-disable-next-line no-var
  var __firmasTempStorage: Map<string, TokenData> | undefined;
}

// Usar globalThis para asegurar que el Map sea compartido entre todas las rutas de API
// Next.js puede crear múltiples instancias del módulo, pero globalThis es único
if (!globalThis.__firmasTempStorage) {
  globalThis.__firmasTempStorage = new Map<string, TokenData>();
}

const firmasTemporales = globalThis.__firmasTempStorage;

/**
 * Limpia tokens expirados del almacenamiento
 */
function limpiarExpirados(): void {
  const now = Date.now();
  for (const [token, data] of firmasTemporales.entries()) {
    if (now - data.createdAt > EXPIRATION_MS) {
      firmasTemporales.delete(token);
    }
  }
}

/**
 * Guarda los datos de una inspección pendiente de firma
 */
export function guardarInspeccionPendiente(token: string, data: Omit<TokenData, "createdAt" | "firmaResponsable">): void {
  limpiarExpirados();
  firmasTemporales.set(token, {
    ...data,
    createdAt: Date.now(),
  });
  console.log(`[TempStorage] Guardado token para área "${data.area}". Total en memoria: ${firmasTemporales.size}`);
}

/**
 * Obtiene los datos de una inspección pendiente
 */
export function obtenerInspeccionPendiente(token: string): TokenData | undefined {
  limpiarExpirados();
  const data = firmasTemporales.get(token);
  console.log(`[TempStorage] Buscando token... Encontrado: ${!!data}. Total en memoria: ${firmasTemporales.size}`);
  return data;
}

/**
 * Guarda la firma del responsable de área (cuando firma remotamente)
 */
export function guardarFirmaResponsable(token: string, firma: FirmaTemporalData): boolean {
  const data = firmasTemporales.get(token);
  if (!data) {
    console.error("Token no encontrado para guardar firma:", token.substring(0, 20) + "...");
    return false;
  }
  
  data.firmaResponsable = firma;
  firmasTemporales.set(token, data);
  console.log("Firma guardada temporalmente para área:", firma.area);
  return true;
}

/**
 * Verifica si el responsable ya firmó
 */
export function verificarFirmaResponsable(token: string): FirmaTemporalData | null {
  const data = firmasTemporales.get(token);
  return data?.firmaResponsable || null;
}

/**
 * Elimina los datos temporales después de guardar exitosamente
 */
export function eliminarInspeccionPendiente(token: string): void {
  firmasTemporales.delete(token);
}

/**
 * Obtiene estadísticas del almacenamiento (para debug)
 */
export function getStats(): { total: number; tokens: string[] } {
  return {
    total: firmasTemporales.size,
    tokens: Array.from(firmasTemporales.keys()).map(t => t.substring(0, 20) + "..."),
  };
}
