// ══════════════════════════════════════════════════════════
// Repositorio Airtable — Módulo Inducciones & Reinducciones
// Implementa operaciones CRUD sobre las 3 tablas del módulo
// ══════════════════════════════════════════════════════════

import {
  airtableInduccionesConfig,
  createInduccionesClient,
  induccionesModuleConfig,
} from "../config/airtableInducciones";
import type {
  RegistroInduccion,
  TokenFirma,
  AlertaLog,
  CrearInduccionDTO,
  ActualizarInduccionDTO,
  EstadoInduccion,
  EstadoToken,
} from "@/shared/types/inducciones";

const RF = airtableInduccionesConfig.registrosFields;
const TF = airtableInduccionesConfig.tokensFields;
const AF = airtableInduccionesConfig.alertasFields;

// ── Repositorio de Registros de Inducción ──────────────────
export class AirtableInduccionesRepository {
  private client;
  private registrosTableId: string;
  private tokensTableId: string;
  private alertasTableId: string;

  constructor() {
    this.client = createInduccionesClient();
    this.registrosTableId = airtableInduccionesConfig.registrosTableId;
    this.tokensTableId = airtableInduccionesConfig.tokensTableId;
    this.alertasTableId = airtableInduccionesConfig.alertasTableId;
  }

  // ── REGISTROS DE INDUCCIÓN ─────────────────────────────────

  /**
   * Listar todos los registros de inducción
   * @param filterByStatus - Opcional: filtrar por estado
   */
  async listarRegistros(filterByStatus?: EstadoInduccion): Promise<RegistroInduccion[]> {
    const url = `${this.client.baseUrl}/${this.registrosTableId}`;
    const params = new URLSearchParams({ pageSize: "100" });

    if (filterByStatus) {
      params.append("filterByFormula", `{Estado} = '${filterByStatus}'`);
    }

    const response = await fetch(`${url}?${params}`, {
      headers: this.client.headers,
    });

    if (!response.ok) {
      throw new Error(`Error listando inducciones: ${response.statusText}`);
    }

    const data = await response.json();
    return data.records.map((record: any) => this.mapRecordToRegistro(record));
  }

  /**
   * Obtener un registro de inducción por ID
   */
  async obtenerRegistroPorId(recordId: string): Promise<RegistroInduccion | null> {
    const url = `${this.client.baseUrl}/${this.registrosTableId}/${recordId}`;

    const response = await fetch(url, {
      headers: this.client.headers,
    });

    if (!response.ok) {
      if (response.status === 404) return null;
      throw new Error(`Error obteniendo inducción: ${response.statusText}`);
    }

    const record = await response.json();
    return this.mapRecordToRegistro(record);
  }

  /**
   * Obtener un registro por ID_Induccion (IND-XXXX)
   */
  async obtenerRegistroPorIdInduccion(idInduccion: string): Promise<RegistroInduccion | null> {
    const url = `${this.client.baseUrl}/${this.registrosTableId}`;
    const params = new URLSearchParams({
      filterByFormula: `{ID_Induccion} = '${idInduccion}'`,
      maxRecords: "1",
    });

    const response = await fetch(`${url}?${params}`, {
      headers: this.client.headers,
    });

    if (!response.ok) {
      throw new Error(`Error buscando inducción: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.records.length === 0) return null;

    return this.mapRecordToRegistro(data.records[0]);
  }

  /**
   * Listar registros de un colaborador específico
   */
  async listarPorEmpleado(idEmpleadoCore: string): Promise<RegistroInduccion[]> {
    const url = `${this.client.baseUrl}/${this.registrosTableId}`;

    // Sin sort por ahora, solo filtro
    const filterFormula = encodeURIComponent(`{ID_Empleado_CORE} = '${idEmpleadoCore}'`);
    const fullUrl = `${url}?filterByFormula=${filterFormula}`;

    const response = await fetch(fullUrl, {
      headers: this.client.headers,
    });

    if (!response.ok) {
      throw new Error(`Error listando inducciones del empleado: ${response.statusText}`);
    }

    const data = await response.json();
    return data.records.map((record: any) => this.mapRecordToRegistro(record));
  }

  /**
   * Crear un nuevo registro de inducción
   */
  async crearRegistro(dto: CrearInduccionDTO, datosEmpleado: {
    nombreCompleto: string;
    numeroDocumento: string;
    cargo: string;
  }): Promise<RegistroInduccion> {
    console.log('[crearRegistro] Iniciando creación de nueva inducción...');

    // Generar ID_Induccion
    const lastId = await this.obtenerUltimoIdInduccion();
    const newIdNum = lastId ? parseInt(lastId.split("-")[1]) + 1 : 1;
    const idInduccion = `IND-${String(newIdNum).padStart(4, "0")}`;

    console.log(`[crearRegistro] Último ID: ${lastId}, Nuevo número: ${newIdNum}, Nuevo ID: ${idInduccion}`);

    // Calcular fecha de vencimiento (parse manual para evitar offset UTC)
    const fechaRealParts = dto.fechaRealizacion.split('-');
    const fechaRealizacion = new Date(
      parseInt(fechaRealParts[0]),
      parseInt(fechaRealParts[1]) - 1,
      parseInt(fechaRealParts[2])
    );

    const fechaVencimiento = new Date(fechaRealizacion);
    fechaVencimiento.setMonth(fechaVencimiento.getMonth() + induccionesModuleConfig.vigenciaMeses);

    // Formatear fecha vencimiento en formato YYYY-MM-DD
    const year = fechaVencimiento.getFullYear();
    const month = String(fechaVencimiento.getMonth() + 1).padStart(2, '0');
    const day = String(fechaVencimiento.getDate()).padStart(2, '0');
    const fechaVencimientoStr = `${year}-${month}-${day}`;

    const url = `${this.client.baseUrl}/${this.registrosTableId}`;
    const payload = {
      fields: {
        [RF.ID_INDUCCION]: idInduccion,
        [RF.ID_EMPLEADO_CORE]: dto.idEmpleadoCore,
        [RF.NOMBRE_EMPLEADO]: datosEmpleado.nombreCompleto,
        [RF.NUMERO_DOCUMENTO]: datosEmpleado.numeroDocumento,
        [RF.CARGO]: datosEmpleado.cargo,
        [RF.TIPO]: dto.tipo,
        [RF.FECHA_REALIZACION]: dto.fechaRealizacion,
        [RF.FECHA_VENCIMIENTO]: fechaVencimientoStr,
        [RF.RESPONSABLE_SST]: dto.responsableSST,
        [RF.ESTADO_EVALUACION]: "Pendiente",
        [RF.ESTADO]: "En_Proceso",
        ...(dto.observaciones && { [RF.OBSERVACIONES]: dto.observaciones }),
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: this.client.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error creando inducción: ${error}`);
    }

    const record = await response.json();
    return this.mapRecordToRegistro(record);
  }

  /**
   * Actualizar un registro de inducción
   */
  async actualizarRegistro(
    recordId: string,
    dto: ActualizarInduccionDTO
  ): Promise<RegistroInduccion> {
    const url = `${this.client.baseUrl}/${this.registrosTableId}/${recordId}`;
    const fields: any = {};

    if (dto.evaluacionId !== undefined) fields[RF.EVALUACION_ID] = dto.evaluacionId;
    if (dto.puntajeEvaluacion !== undefined) fields[RF.PUNTAJE_EVALUACION] = dto.puntajeEvaluacion;
    if (dto.estadoEvaluacion) fields[RF.ESTADO_EVALUACION] = dto.estadoEvaluacion;
    if (dto.firmaUrl !== undefined) fields[RF.FIRMA_URL] = dto.firmaUrl;
    if (dto.certificadoUrl !== undefined) fields[RF.CERTIFICADO_URL] = dto.certificadoUrl;
    if (dto.fechaExportacion !== undefined) fields[RF.FECHA_EXPORTACION] = dto.fechaExportacion;
    if (dto.estado) fields[RF.ESTADO] = dto.estado;
    if (dto.observaciones !== undefined) fields[RF.OBSERVACIONES] = dto.observaciones;

    const response = await fetch(url, {
      method: "PATCH",
      headers: this.client.headers,
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error actualizando inducción: ${error}`);
    }

    const record = await response.json();
    return this.mapRecordToRegistro(record);
  }

  // ── TOKENS DE FIRMA ────────────────────────────────────────

  /**
   * Crear un token de firma
   */
  async crearTokenFirma(
    induccionId: string,
    idEmpleadoCore: string
  ): Promise<TokenFirma> {
    // Generar Token_ID
    const lastId = await this.obtenerUltimoIdToken();
    const newIdNum = lastId ? parseInt(lastId.split("-")[1]) + 1 : 1;
    const tokenId = `TKNI-${String(newIdNum).padStart(4, "0")}`;

    // Fechas (expiracion según configuración)
    const now = new Date();
    const expiracion = new Date(
      now.getTime() + induccionesModuleConfig.tokenExpiracionHoras * 60 * 60 * 1000
    );

    // Generar JWT simple (base64 + firma)
    const crypto = require("crypto");
    const secret = process.env.JWT_SECRET || "default-secret";
    const tokenPayload = {
      induccionId,
      idEmpleadoCore,
      tokenId,
      exp: expiracion.getTime(),
    };
    const payloadB64 = Buffer.from(JSON.stringify(tokenPayload)).toString("base64url");
    const signature = crypto
      .createHmac("sha256", secret)
      .update(payloadB64)
      .digest("base64url")
      .substring(0, 32);
    const hashFirma = `${payloadB64}.${signature}`;

    const url = `${this.client.baseUrl}/${this.tokensTableId}`;
    const payload = {
      fields: {
        [TF.TOKEN_ID]: tokenId,
        [TF.INDUCCION_ID]: induccionId,
        [TF.ID_EMPLEADO_CORE]: idEmpleadoCore,
        [TF.HASH_FIRMA]: hashFirma,
        [TF.FECHA_GENERACION]: now.toISOString(),
        [TF.FECHA_EXPIRACION]: expiracion.toISOString(),
        [TF.ESTADO_TOKEN]: "Pendiente",
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: this.client.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error creando token: ${error}`);
    }

    const record = await response.json();
    return this.mapRecordToToken(record);
  }

  /**
   * Obtener token por Token_ID
   */
  async obtenerTokenPorId(tokenId: string): Promise<TokenFirma | null> {
    const url = `${this.client.baseUrl}/${this.tokensTableId}`;
    const params = new URLSearchParams({
      filterByFormula: `{Token_ID} = '${tokenId}'`,
      maxRecords: "1",
    });

    const response = await fetch(`${url}?${params}`, {
      headers: this.client.headers,
    });

    if (!response.ok) {
      throw new Error(`Error buscando token: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.records.length === 0) return null;

    return this.mapRecordToToken(data.records[0]);
  }

  /**
   * Obtener token por Hash de Firma (el JWT token propiamente)
   */
  async obtenerTokenPorHash(hashFirma: string): Promise<TokenFirma | null> {
    const url = `${this.client.baseUrl}/${this.tokensTableId}`;
    const params = new URLSearchParams({
      filterByFormula: `{Hash_Firma} = '${hashFirma}'`,
      maxRecords: "1",
    });

    const response = await fetch(`${url}?${params}`, {
      headers: this.client.headers,
    });

    if (!response.ok) {
      throw new Error(`Error buscando token por hash: ${response.statusText}`);
    }

    const data = await response.json();
    if (data.records.length === 0) return null;

    return this.mapRecordToToken(data.records[0]);
  }

  /**
   * Actualizar estado del token y guardar firma
   */
  async actualizarToken(
    recordId: string,
    updates: { estadoToken?: EstadoToken; hashFirma?: string }
  ): Promise<TokenFirma> {
    const url = `${this.client.baseUrl}/${this.tokensTableId}/${recordId}`;
    const fields: any = {};

    if (updates.estadoToken) {
      fields[TF.ESTADO_TOKEN] = updates.estadoToken;
    }

    if (updates.hashFirma) {
      fields[TF.HASH_FIRMA] = updates.hashFirma;
    }

    const response = await fetch(url, {
      method: "PATCH",
      headers: this.client.headers,
      body: JSON.stringify({ fields }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error actualizando token: ${error}`);
    }

    const record = await response.json();
    return this.mapRecordToToken(record);
  }

  // ── ALERTAS ────────────────────────────────────────────────

  /**
   * Crear una alerta de vencimiento
   */
  async crearAlerta(
    induccionId: string,
    idEmpleadoCore: string,
    nombreEmpleado: string,
    fechaVencimiento: string,
    fechaAlerta: string
  ): Promise<AlertaLog> {
    // Generar ID_Alerta
    const lastId = await this.obtenerUltimoIdAlerta();
    const newIdNum = lastId ? parseInt(lastId.split("-")[2]) + 1 : 1;
    const idAlerta = `ALERTA-IND-${String(newIdNum).padStart(4, "0")}`;

    const url = `${this.client.baseUrl}/${this.alertasTableId}`;
    const payload = {
      fields: {
        [AF.ID_ALERTA]: idAlerta,
        [AF.INDUCCION_ID]: induccionId,
        [AF.ID_EMPLEADO_CORE]: idEmpleadoCore,
        [AF.NOMBRE_EMPLEADO]: nombreEmpleado,
        [AF.FECHA_VENCIMIENTO]: fechaVencimiento,
        [AF.FECHA_ALERTA]: fechaAlerta,
        [AF.TIPO_ALERTA]: "15_DIAS",
        [AF.ENVIADA]: false,
      },
    };

    const response = await fetch(url, {
      method: "POST",
      headers: this.client.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error creando alerta: ${error}`);
    }

    const record = await response.json();
    return this.mapRecordToAlerta(record);
  }

  /**
   * Listar alertas pendientes (no enviadas)
   */
  async listarAlertasPendientes(): Promise<AlertaLog[]> {
    const hoy = new Date().toISOString().split("T")[0];
    const url = `${this.client.baseUrl}/${this.alertasTableId}`;
    const params = new URLSearchParams({
      filterByFormula: `AND({Enviada} = FALSE(), {Fecha_Alerta} <= '${hoy}')`,
      sort: JSON.stringify([{field: 'Fecha_Alerta', direction: 'asc'}]),
    });

    const response = await fetch(`${url}?${params}`, {
      headers: this.client.headers,
    });

    if (!response.ok) {
      throw new Error(`Error listando alertas: ${response.statusText}`);
    }

    const data = await response.json();
    return data.records.map((record: any) => this.mapRecordToAlerta(record));
  }

  /**
   * Marcar alerta como gestionada (Fase 1 - manual)
   */
  async marcarAlertaGestionada(recordId: string): Promise<AlertaLog> {
    const url = `${this.client.baseUrl}/${this.alertasTableId}/${recordId}`;
    const payload = {
      fields: {
        [AF.ENVIADA]: true,
        [AF.FECHA_ENVIO]: new Date().toISOString(),
      },
    };

    const response = await fetch(url, {
      method: "PATCH",
      headers: this.client.headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Error marcando alerta: ${error}`);
    }

    const record = await response.json();
    return this.mapRecordToAlerta(record);
  }

  // ── HELPERS PRIVADOS ───────────────────────────────────────

  private async obtenerUltimoIdInduccion(): Promise<string | null> {
    const url = `${this.client.baseUrl}/${this.registrosTableId}`;

    console.log('[obtenerUltimoIdInduccion] Consultando último ID...');

    // Estrategia: obtener todos los IDs y ordenar en JS (más confiable)
    const params = new URLSearchParams({
      fields: JSON.stringify(['ID_Induccion']), // Solo traer el campo que necesitamos
      pageSize: "100", // Traer últimos 100 registros
    });

    const response = await fetch(`${url}?${params}`, {
      headers: this.client.headers,
    });

    if (!response.ok) {
      console.error('[obtenerUltimoIdInduccion] Error en la consulta:', await response.text());
      return null;
    }

    const data = await response.json();

    if (data.records.length === 0) {
      console.log('[obtenerUltimoIdInduccion] No hay registros, iniciando en IND-0001');
      return null;
    }

    // Ordenar en JS por número extraído (más confiable que sort de Airtable)
    const ids = data.records
      .map((r: any) => r.fields['ID_Induccion'])
      .filter(Boolean)
      .map((id: string) => ({
        original: id,
        numero: parseInt(id.split('-')[1] || '0', 10)
      }))
      .sort((a, b) => b.numero - a.numero); // DESC

    const lastId = ids.length > 0 ? ids[0].original : null;
    console.log(`[obtenerUltimoIdInduccion] Último ID encontrado: ${lastId || 'NINGUNO (primera inducción)'}`);
    console.log(`[obtenerUltimoIdInduccion] Total de registros analizados: ${data.records.length}`);

    return lastId;
  }

  private async obtenerUltimoIdToken(): Promise<string | null> {
    const url = `${this.client.baseUrl}/${this.tokensTableId}`;

    console.log('[obtenerUltimoIdToken] Consultando último Token_ID...');

    // Estrategia: obtener todos los IDs y ordenar en JS (más confiable)
    const params = new URLSearchParams({
      fields: JSON.stringify(['Token_ID']),
      pageSize: "100",
    });

    const response = await fetch(`${url}?${params}`, {
      headers: this.client.headers,
    });

    if (!response.ok) {
      console.error('[obtenerUltimoIdToken] Error en la consulta:', await response.text());
      return null;
    }

    const data = await response.json();

    if (data.records.length === 0) {
      console.log('[obtenerUltimoIdToken] No hay registros, iniciando en TKNI-0001');
      return null;
    }

    // Ordenar en JS por número extraído
    const ids = data.records
      .map((r: any) => r.fields['Token_ID'])
      .filter(Boolean)
      .map((id: string) => ({
        original: id,
        numero: parseInt(id.split('-')[1] || '0', 10)
      }))
      .sort((a, b) => b.numero - a.numero); // DESC

    const lastId = ids.length > 0 ? ids[0].original : null;
    console.log(`[obtenerUltimoIdToken] Último Token_ID encontrado: ${lastId || 'NINGUNO'}`);

    return lastId;
  }

  private async obtenerUltimoIdAlerta(): Promise<string | null> {
    const url = `${this.client.baseUrl}/${this.alertasTableId}`;

    console.log('[obtenerUltimoIdAlerta] Consultando último ID_Alerta...');

    // Estrategia: obtener todos los IDs y ordenar en JS (más confiable)
    const params = new URLSearchParams({
      fields: JSON.stringify(['ID_Alerta']),
      pageSize: "100",
    });

    const response = await fetch(`${url}?${params}`, {
      headers: this.client.headers,
    });

    if (!response.ok) {
      console.error('[obtenerUltimoIdAlerta] Error en la consulta:', await response.text());
      return null;
    }

    const data = await response.json();

    if (data.records.length === 0) {
      console.log('[obtenerUltimoIdAlerta] No hay registros, iniciando en ALR-IND-0001');
      return null;
    }

    // Ordenar en JS por número extraído
    const ids = data.records
      .map((r: any) => r.fields['ID_Alerta'])
      .filter(Boolean)
      .map((id: string) => ({
        original: id,
        numero: parseInt(id.split('-').pop() || '0', 10) // Último segmento después del guion
      }))
      .sort((a, b) => b.numero - a.numero); // DESC

    const lastId = ids.length > 0 ? ids[0].original : null;
    console.log(`[obtenerUltimoIdAlerta] Último ID_Alerta encontrado: ${lastId || 'NINGUNO'}`);

    return lastId;
  }

  // ── MAPPERS ────────────────────────────────────────────────

  private mapRecordToRegistro(record: any): RegistroInduccion {
    const f = record.fields;

    // Usar nombres de campos directamente (Airtable devuelve nombres, no IDs)
    return {
      id: record.id,
      idInduccion: f["ID_Induccion"] || f[RF.ID_INDUCCION],
      idEmpleadoCore: f["ID_Empleado_CORE"] || f[RF.ID_EMPLEADO_CORE],
      nombreEmpleado: f["Nombre_Empleado"] || f[RF.NOMBRE_EMPLEADO],
      numeroDocumento: f["Numero_Documento"] || f[RF.NUMERO_DOCUMENTO],
      cargo: f["Cargo"] || f[RF.CARGO],
      tipo: f["Tipo"] || f[RF.TIPO],
      fechaRealizacion: f["Fecha_Realizacion"] || f[RF.FECHA_REALIZACION],
      fechaVencimiento: f["Fecha_Vencimiento"] || f[RF.FECHA_VENCIMIENTO],
      responsableSST: f["Responsable_SST"] || f[RF.RESPONSABLE_SST],
      evaluacionId: f["Evaluacion_ID"] || f[RF.EVALUACION_ID] || null,
      puntajeEvaluacion: f["Puntaje_Evaluacion"] || f[RF.PUNTAJE_EVALUACION] || null,
      estadoEvaluacion: f["Estado_Evaluacion"] || f[RF.ESTADO_EVALUACION] || "Pendiente",
      firmaUrl: f["Firma_URL"] || f[RF.FIRMA_URL] || null,
      certificadoUrl: f["Certificado_URL"] || f[RF.CERTIFICADO_URL] || null,
      fechaExportacion: f["Fecha_Exportacion"] || f[RF.FECHA_EXPORTACION] || null,
      estado: f["Estado"] || f[RF.ESTADO] || "En_Proceso",
      observaciones: f["Observaciones"] || f[RF.OBSERVACIONES] || null,
    };
  }

  private mapRecordToToken(record: any): TokenFirma {
    const f = record.fields;
    return {
      id: record.id,
      tokenId: f["Token_ID"] || f[TF.TOKEN_ID],
      induccionId: f["Induccion_ID"] || f[TF.INDUCCION_ID],
      idEmpleadoCore: f["ID_Empleado_CORE"] || f[TF.ID_EMPLEADO_CORE],
      hashFirma: f["Hash_Firma"] || f[TF.HASH_FIRMA] || null,
      fechaGeneracion: f["Fecha_Generacion"] || f[TF.FECHA_GENERACION],
      fechaExpiracion: f["Fecha_Expiracion"] || f[TF.FECHA_EXPIRACION],
      estadoToken: f["Estado_Token"] || f[TF.ESTADO_TOKEN] || "Pendiente",
    };
  }

  private mapRecordToAlerta(record: any): AlertaLog {
    const f = record.fields;
    return {
      id: record.id,
      idAlerta: f["ID_Alerta"] || f[AF.ID_ALERTA],
      induccionId: f["Induccion_ID"] || f[AF.INDUCCION_ID],
      idEmpleadoCore: f["ID_Empleado_CORE"] || f[AF.ID_EMPLEADO_CORE],
      nombreEmpleado: f["Nombre_Empleado"] || f[AF.NOMBRE_EMPLEADO],
      fechaVencimiento: f["Fecha_Vencimiento"] || f[AF.FECHA_VENCIMIENTO],
      fechaAlerta: f["Fecha_Alerta"] || f[AF.FECHA_ALERTA],
      tipoAlerta: f["Tipo_Alerta"] || f[AF.TIPO_ALERTA] || "15_DIAS",
      enviada: f["Enviada"] || f[AF.ENVIADA] || false,
      fechaEnvio: f["Fecha_Envio"] || f[AF.FECHA_ENVIO] || null,
      correoDestino: f["Correo_Destino"] || f[AF.CORREO_DESTINO] || null,
      observacionesEnvio: f["Observaciones_Envio"] || f[AF.OBSERVACIONES_ENVIO] || null,
    };
  }
}

// Exportar instancia singleton
export const induccionesRepository = new AirtableInduccionesRepository();
