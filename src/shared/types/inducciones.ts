// ══════════════════════════════════════════════════════════
// Tipos y entidades del módulo Inducciones & Reinducciones
// ══════════════════════════════════════════════════════════

import { z } from "zod";

// ── Enums ───────────────────────────────────────────────────
export const TipoInduccionEnum = z.enum(["Induccion", "Reinduccion"]);
export type TipoInduccion = z.infer<typeof TipoInduccionEnum>;

export const EstadoInduccionEnum = z.enum(["En_Proceso", "Pendiente_Firma", "Completada"]);
export type EstadoInduccion = z.infer<typeof EstadoInduccionEnum>;

export const EstadoEvaluacionEnum = z.enum(["Aprobada", "Pendiente", "No_Presentada"]);
export type EstadoEvaluacion = z.infer<typeof EstadoEvaluacionEnum>;

export const EstadoTokenEnum = z.enum(["Pendiente", "Usado", "Expirado"]);
export type EstadoToken = z.infer<typeof EstadoTokenEnum>;

export const TipoAlertaEnum = z.enum(["15_DIAS"]);
export type TipoAlerta = z.infer<typeof TipoAlertaEnum>;

// ── Schemas Zod ─────────────────────────────────────────────

// Registro de Inducción
export const RegistroInduccionSchema = z.object({
  id: z.string().optional(), // Record ID de Airtable
  idInduccion: z.string().regex(/^IND-\d{4}$/), // Formato IND-XXXX
  idEmpleadoCore: z.string().min(3), // ID Empleado (SIRIUS-PER-XXXX) o record ID legacy
  nombreEmpleado: z.string().min(3),
  numeroDocumento: z.string().min(5),
  cargo: z.string().min(2),
  tipo: TipoInduccionEnum,
  fechaRealizacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // ISO date
  fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  responsableSST: z.string().min(3),
  evaluacionId: z.string().optional().nullable(),
  puntajeEvaluacion: z.number().min(0).max(100).optional().nullable(),
  estadoEvaluacion: EstadoEvaluacionEnum,
  firmaUrl: z.string().url().optional().nullable(),
  certificadoUrl: z.string().url().optional().nullable(),
  fechaExportacion: z.string().optional().nullable(), // ISO datetime
  estado: EstadoInduccionEnum,
  observaciones: z.string().optional().nullable(),
});

export type RegistroInduccion = z.infer<typeof RegistroInduccionSchema>;

// Token de Firma
export const TokenFirmaSchema = z.object({
  id: z.string().optional(), // Record ID de Airtable
  tokenId: z.string().regex(/^TKNI-\d{4}$/), // Formato TKNI-XXXX
  induccionId: z.string().regex(/^IND-\d{4}$/),
  idEmpleadoCore: z.string().min(3), // ID Empleado (SIRIUS-PER-XXXX) o record ID legacy
  hashFirma: z.string().optional().nullable(), // Data URL base64
  fechaGeneracion: z.string(), // ISO datetime
  fechaExpiracion: z.string(), // ISO datetime
  estadoToken: EstadoTokenEnum,
});

export type TokenFirma = z.infer<typeof TokenFirmaSchema>;

// Alerta de Vencimiento
export const AlertaLogSchema = z.object({
  id: z.string().optional(), // Record ID de Airtable
  idAlerta: z.string().regex(/^ALERTA-IND-\d{4}$/), // Formato ALERTA-IND-XXXX
  induccionId: z.string().regex(/^IND-\d{4}$/),
  idEmpleadoCore: z.string().min(3), // ID Empleado (SIRIUS-PER-XXXX) o record ID legacy
  nombreEmpleado: z.string().min(3),
  fechaVencimiento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  fechaAlerta: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  tipoAlerta: TipoAlertaEnum,
  enviada: z.boolean().default(false),
  fechaEnvio: z.string().optional().nullable(), // ISO datetime
  correoDestino: z.string().email().optional().nullable(),
  observacionesEnvio: z.string().optional().nullable(),
});

export type AlertaLog = z.infer<typeof AlertaLogSchema>;

// ── DTOs para API ───────────────────────────────────────────

// Crear nueva inducción
export const CrearInduccionDTOSchema = z.object({
  idEmpleadoCore: z.string().min(3), // ID Empleado (SIRIUS-PER-XXXX) o record ID legacy
  tipo: TipoInduccionEnum,
  fechaRealizacion: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  responsableSST: z.string().min(3),
  observaciones: z.string().optional().nullable(),
});

export type CrearInduccionDTO = z.infer<typeof CrearInduccionDTOSchema>;

// Actualizar inducción
export const ActualizarInduccionDTOSchema = z.object({
  evaluacionId: z.string().optional().nullable(),
  puntajeEvaluacion: z.number().min(0).max(100).optional().nullable(),
  estadoEvaluacion: EstadoEvaluacionEnum.optional(),
  firmaUrl: z.string().url().optional().nullable(),
  certificadoUrl: z.string().url().optional().nullable(),
  fechaExportacion: z.string().optional().nullable(),
  estado: EstadoInduccionEnum.optional(),
  observaciones: z.string().optional().nullable(),
});

export type ActualizarInduccionDTO = z.infer<typeof ActualizarInduccionDTOSchema>;

// Firmar inducción
export const FirmarInduccionDTOSchema = z.object({
  token: z.string().min(10), // JWT o token string
  firmaDataUrl: z.string().startsWith("data:image/"), // Base64 data URL
});

export type FirmarInduccionDTO = z.infer<typeof FirmarInduccionDTOSchema>;

// Estado del colaborador (para dashboard)
export const EstadoColaboradorSchema = z.object({
  idEmpleadoCore: z.string().min(3), // ID Empleado (SIRIUS-PER-XXXX) o record ID legacy
  nombreCompleto: z.string(),
  numeroDocumento: z.string(),
  cargo: z.string(),
  // Estado de la inducción
  tieneInduccion: z.boolean(),
  ultimaInduccion: RegistroInduccionSchema.nullable(),
  estadoSemaforo: z.enum(["AL_DIA", "POR_VENCER", "VENCIDA", "SIN_INDUCCION"]),
  diasParaVencimiento: z.number().nullable(),
  alertaActiva: z.boolean(),
});

export type EstadoColaborador = z.infer<typeof EstadoColaboradorSchema>;

// ── Módulos temáticos (constantes) ─────────────────────────
export interface ModuloInduccion {
  nombre: string;
  temas: string[];
}

export interface ModulosInduccion {
  administrativa: ModuloInduccion;
  sst: ModuloInduccion;
  medioAmbiente: ModuloInduccion;
}
