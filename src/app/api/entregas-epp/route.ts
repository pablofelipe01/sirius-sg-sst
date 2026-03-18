import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";
import {
  airtableInsumosConfig,
  getInsumosUrl,
  getInsumosHeaders,
} from "@/infrastructure/config/airtableInsumos";
import {
  airtableConfig,
  getAirtableUrl,
  getAirtableHeaders,
} from "@/infrastructure/config/airtable";

// ── Tipos ───────────────────────────────────────────────
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

// ── Tipos del request ───────────────────────────────────
interface LineaEntregaBody {
  insumoId: string;       // Record ID del insumo en Insumos Core
  codigoInsumo: string;   // Código (ej: SIRIUS-INS-0012)
  nombre: string;         // Nombre del EPP
  cantidad: number;
  talla?: string;         // XS, S, M, L, XL, XXL, Única, N/A
  condicion?: string;     // Nuevo, Reacondicionado, Usado - Buen Estado
}

interface BeneficiarioBody {
  idEmpleado: string;
  nombreCompleto: string;
  numeroDocumento: string;
  lineas: LineaEntregaBody[];
}

interface EntregaRequestBody {
  beneficiarios: BeneficiarioBody[];
  responsable: string;       // "Coordinador SST"
  responsableId: string;     // ID Empleado del que registra
  observaciones: string;
  motivo: string;            // "Dotación Inicial", etc.
  fechaEntrega: string;      // ISO date "2026-02-18"
}

// ── Helpers ─────────────────────────────────────────────
function generateTokenId(): string {
  return crypto.randomBytes(16).toString("hex").toUpperCase();
}

async function createAirtableRecords(
  tableId: string,
  records: Record<string, unknown>[],
  headers: HeadersInit
): Promise<{ id: string; fields: Record<string, unknown> }[]> {
  const url = `${getSGSSTUrl(tableId)}?returnFieldsByFieldId=true`;

  // Airtable allows max 10 records per request
  const results: { id: string; fields: Record<string, unknown> }[] = [];
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ records: batch.map((fields) => ({ fields })), typecast: true }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.error(`Airtable create error (${tableId}):`, res.status, err);
      throw new Error(`Error creating records in ${tableId}: ${res.status}`);
    }
    const data = await res.json();
    results.push(...data.records);
  }
  return results;
}

/**
 * POST /api/entregas-epp
 *
 * Flujo completo de entrega:
 * 1. Crea 1 registro en "Entregas EPP" por beneficiario (Estado: Pendiente)
 * 2. Crea N registros en "Detalle Entrega EPP" vinculados a la entrega
 * 3. Crea N registros en "Historial EPP Empleado" vinculados a la entrega
 * 4. Crea 1 registro en "Tokens Entrega" por beneficiario (Estado: Activo)
 * 5. Crea N movimientos de "Salida" en Insumos Core
 * 6. Vincula detalles, tokens e historial a la entrega (PATCH)
 */
export async function POST(request: NextRequest) {
  try {
    const body: EntregaRequestBody = await request.json();

    // Validar
    if (!body.beneficiarios?.length) {
      return NextResponse.json(
        { success: false, message: "Se requiere al menos un beneficiario" },
        { status: 400 }
      );
    }

    const headers = getSGSSTHeaders();
    const insHeaders = getInsumosHeaders();
    const {
      entregasTableId,
      entregasFields,
      detalleTableId,
      detalleFields,
      tokensTableId,
      tokensFields,
      historialTableId,
      historialFields,
    } = airtableSGSSTConfig;

    const { movimientosTableId, movimientosFields } = airtableInsumosConfig;

    const entregas: {
      entregaId: string;
      tokenId: string;
      tokenRecordId: string;
      idEmpleado: string;
      nombreCompleto: string;
      numeroDocumento: string;
    }[] = [];

    for (const ben of body.beneficiarios) {
      // ── 1. Crear Entregas EPP ─────────────────────────
      const entregaFields: Record<string, unknown> = {
        [entregasFields.FECHA_ENTREGA]: body.fechaEntrega,
        [entregasFields.RESPONSABLE]: body.responsable,
        [entregasFields.OBSERVACIONES]: body.observaciones || "",
        [entregasFields.ID_EMPLEADO_CORE]: ben.idEmpleado,
        [entregasFields.ESTADO]: "Pendiente",
        [entregasFields.MOTIVO]: body.motivo,
      };

      const [entregaRecord] = await createAirtableRecords(
        entregasTableId,
        [entregaFields],
        headers
      );
      const entregaId = entregaRecord.id;

      // ── 2. Crear Detalle Entrega EPP ──────────────────
      const detalleRecords = ben.lineas.map((linea) => ({
        [detalleFields.CANTIDAD]: linea.cantidad,
        [detalleFields.ENTREGA_LINK]: [entregaId],
        [detalleFields.TALLA]: linea.talla || "Única",
        [detalleFields.CONDICION]: linea.condicion || "Nuevo",
        [detalleFields.CODIGO_INSUMO]: linea.codigoInsumo,
      }));

      const detalleCreated = await createAirtableRecords(
        detalleTableId,
        detalleRecords,
        headers
      );

      // ── 3. Crear Historial EPP Empleado ───────────────
      const historialRecords = ben.lineas.map((linea) => ({
        [historialFields.FECHA_ENTREGA]: body.fechaEntrega,
        [historialFields.ESTADO]: "Vigente",
        [historialFields.ID_EMPLEADO_CORE]: ben.idEmpleado,
        [historialFields.ENTREGA_ORIGEN]: [entregaId],
        [historialFields.CODIGO_INSUMO]: linea.codigoInsumo,
      }));

      const historialCreated = await createAirtableRecords(
        historialTableId,
        historialRecords,
        headers
      );

      // ── 4. Crear Token de Entrega ─────────────────────
      const tokenIdStr = generateTokenId();
      const ahora = new Date();
      const expiracion = new Date(ahora.getTime() + 48 * 60 * 60 * 1000); // 48h

      const tokenFields: Record<string, unknown> = {
        [tokensFields.TOKEN_ID]: tokenIdStr,
        [tokensFields.FECHA_GENERACION]: ahora.toISOString(),
        [tokensFields.FECHA_EXPIRACION]: expiracion.toISOString(),
        [tokensFields.TIPO_VERIFICACION]: "PIN + Cédula",
        [tokensFields.ENTREGA_LINK]: [entregaId],
        [tokensFields.ID_EMPLEADO_CORE]: ben.idEmpleado,
        [tokensFields.ESTADO]: "Activo",
      };

      const [tokenRecord] = await createAirtableRecords(
        tokensTableId,
        [tokenFields],
        headers
      );

      // ── 5. Vincular detalles, tokens e historial a la entrega ──
      const patchUrl = `${getSGSSTUrl(entregasTableId)}?returnFieldsByFieldId=true`;
      await fetch(patchUrl, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          records: [
            {
              id: entregaId,
              fields: {
                [entregasFields.DETALLE_LINK]: detalleCreated.map((r) => r.id),
                [entregasFields.TOKENS_LINK]: [tokenRecord.id],
                [entregasFields.HISTORIAL_LINK]: historialCreated.map((r) => r.id),
              },
            },
          ],
        }),
      });

      // ── 6. Crear movimientos de Salida en Insumos Core ──
      for (const linea of ben.lineas) {
        const descripcion = `Entrega EPP: ${linea.nombre} → ${ben.nombreCompleto}`;
        const movFields: Record<string, unknown> = {
          [movimientosFields.NOMBRE]: descripcion,
          [movimientosFields.CANTIDAD]: linea.cantidad,
          [movimientosFields.TIPO]: "Salida",
          [movimientosFields.INSUMO]: [linea.insumoId],
          [movimientosFields.RESPONSABLE]: body.responsableId,
        };

        const movUrl = `${getInsumosUrl(movimientosTableId)}?returnFieldsByFieldId=true`;
        const movRes = await fetch(movUrl, {
          method: "POST",
          headers: insHeaders,
          body: JSON.stringify({ records: [{ fields: movFields }], typecast: true }),
        });

        if (!movRes.ok) {
          console.error("Movimiento Salida error:", await movRes.text());
        }
      }

      entregas.push({
        entregaId,
        tokenId: tokenIdStr,
        tokenRecordId: tokenRecord.id,
        idEmpleado: ben.idEmpleado,
        nombreCompleto: ben.nombreCompleto,
        numeroDocumento: ben.numeroDocumento,
      });
    }

    return NextResponse.json({
      success: true,
      message: `Se crearon ${entregas.length} entrega(s) exitosamente`,
      entregas,
    });
  } catch (error) {
    console.error("Error creating entregas EPP:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/entregas-epp
 *
 * Lista todas las entregas EPP con su detalle y tokens asociados.
 */
export async function GET() {
  try {
    const headers = getSGSSTHeaders();
    const {
      entregasTableId,
      entregasFields,
      detalleTableId,
      detalleFields,
      tokensTableId,
      tokensFields,
    } = airtableSGSSTConfig;

    // ── 1. Obtener todas las entregas ───────────────────
    let allEntregas: AirtableRecord[] = [];
    let offset: string | undefined;

    do {
      const params = new URLSearchParams({
        pageSize: "100",
        returnFieldsByFieldId: "true",
        "sort[0][field]": entregasFields.FECHA_ENTREGA,
        "sort[0][direction]": "desc",
      });
      if (offset) params.set("offset", offset);

      const res = await fetch(
        `${getSGSSTUrl(entregasTableId)}?${params.toString()}`,
        { headers }
      );
      if (!res.ok) {
        const err = await res.text();
        console.error("Error fetching entregas:", err);
        throw new Error("Error al consultar entregas");
      }
      const data: AirtableListResponse = await res.json();
      allEntregas = [...allEntregas, ...data.records];
      offset = data.offset;
    } while (offset);

    // ── 2. Recopilar IDs de detalle y tokens ────────────
    const detalleIds = new Set<string>();
    const tokenIds = new Set<string>();

    for (const ent of allEntregas) {
      const dLinks = ent.fields[entregasFields.DETALLE_LINK] as string[] | undefined;
      const tLinks = ent.fields[entregasFields.TOKENS_LINK] as string[] | undefined;
      dLinks?.forEach((id) => detalleIds.add(id));
      tLinks?.forEach((id) => tokenIds.add(id));
    }

    // ── 3. Fetch detalles por IDs ───────────────────────
    const detalleMap = new Map<string, AirtableRecord>();
    const detalleArr = Array.from(detalleIds);
    for (let i = 0; i < detalleArr.length; i += 100) {
      const batch = detalleArr.slice(i, i + 100);
      const formula = `OR(${batch.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
      const params = new URLSearchParams({
        filterByFormula: formula,
        pageSize: "100",
        returnFieldsByFieldId: "true",
      });
      const res = await fetch(
        `${getSGSSTUrl(detalleTableId)}?${params.toString()}`,
        { headers }
      );
      if (res.ok) {
        const data: AirtableListResponse = await res.json();
        for (const r of data.records) detalleMap.set(r.id, r);
      }
    }

    // ── 4. Fetch tokens por IDs ─────────────────────────
    const tokenMap = new Map<string, AirtableRecord>();
    const tokenArr = Array.from(tokenIds);
    for (let i = 0; i < tokenArr.length; i += 100) {
      const batch = tokenArr.slice(i, i + 100);
      const formula = `OR(${batch.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
      const params = new URLSearchParams({
        filterByFormula: formula,
        pageSize: "100",
        returnFieldsByFieldId: "true",
      });
      const res = await fetch(
        `${getSGSSTUrl(tokensTableId)}?${params.toString()}`,
        { headers }
      );
      if (res.ok) {
        const data: AirtableListResponse = await res.json();
        for (const r of data.records) tokenMap.set(r.id, r);
      }
    }

    // ── 5. Resolver nombres de insumos ─────────────────
    // Recopilar todos los códigos de insumo únicos y obtener sus nombres
    const insumoNombreMap = new Map<string, string>();
    try {
      const { insumoTableId, insumoFields } = airtableInsumosConfig;
      const insHeaders = getInsumosHeaders();

      // Recopilar códigos únicos de todos los detalles
      const codigosInsumo = new Set<string>();
      for (const r of detalleMap.values()) {
        const codigo = r.fields[detalleFields.CODIGO_INSUMO] as string;
        if (codigo) codigosInsumo.add(codigo);
      }

      // Fetch insumos para obtener nombres
      if (codigosInsumo.size > 0) {
        let insOffset: string | undefined;
        do {
          const insParams = new URLSearchParams({
            pageSize: "100",
            returnFieldsByFieldId: "true",
          });
          if (insOffset) insParams.set("offset", insOffset);

          const insRes = await fetch(
            `${getInsumosUrl(insumoTableId)}?${insParams.toString()}`,
            { headers: insHeaders }
          );
          if (!insRes.ok) {
            console.error("Error fetching insumos:", insRes.status, await insRes.text());
            break;
          }
          const insData: AirtableListResponse = await insRes.json();
          for (const r of insData.records) {
            const codigo = r.fields[insumoFields.CODIGO] as string;
            const nombre = r.fields[insumoFields.NOMBRE] as string;
            if (codigo && nombre) insumoNombreMap.set(codigo, nombre);
          }
          insOffset = insData.offset;
        } while (insOffset);
      }
    } catch (e) {
      console.error("Error resolviendo nombres de insumos:", e);
    }

    // ── 6. Resolver nombres de empleados ────────────────
    // Se trae toda la tabla Personal (mismo patrón que /exportar) porque
    // ID_EMPLEADO puede ser campo fórmula no filtrable directamente.
    const nombreMap = new Map<string, string>();
    try {
      const { personalTableId, personalFields } = airtableConfig;
      const personalHeaders = getAirtableHeaders();
      let pOffset: string | undefined;

      do {
        const pParams = new URLSearchParams({
          pageSize: "100",
          returnFieldsByFieldId: "true",
        });
        if (pOffset) pParams.set("offset", pOffset);

        const pRes = await fetch(
          `${getAirtableUrl(personalTableId)}?${pParams.toString()}`,
          { headers: personalHeaders }
        );
        if (!pRes.ok) {
          console.error("Error fetching personal para nombres:", pRes.status, await pRes.text());
          break;
        }
        const pData: AirtableListResponse = await pRes.json();
        for (const r of pData.records) {
          const empId = r.fields[personalFields.ID_EMPLEADO] as string;
          const nombre = r.fields[personalFields.NOMBRE_COMPLETO] as string;
          if (empId && nombre) nombreMap.set(empId, nombre);
        }
        pOffset = pData.offset;
      } while (pOffset);
    } catch (e) {
      console.error("Error resolviendo nombres de empleados:", e);
    }

    // ── 7. Mapear respuesta ─────────────────────────────
    const result = allEntregas.map((ent) => {
      const f = ent.fields;
      const dLinks = (f[entregasFields.DETALLE_LINK] as string[]) || [];
      const tLinks = (f[entregasFields.TOKENS_LINK] as string[]) || [];

      const detalles = dLinks
        .map((id) => {
          const r = detalleMap.get(id);
          if (!r) return null;
          const df = r.fields;
          const codigoInsumo = (df[detalleFields.CODIGO_INSUMO] as string) || "";
          return {
            id: r.id,
            cantidad: (df[detalleFields.CANTIDAD] as number) || 0,
            talla: (df[detalleFields.TALLA] as string) || "",
            condicion: (df[detalleFields.CONDICION] as string) || "",
            codigoInsumo,
            nombreInsumo: insumoNombreMap.get(codigoInsumo) || codigoInsumo,
          };
        })
        .filter(Boolean);

      const tokens = tLinks
        .map((id) => {
          const r = tokenMap.get(id);
          if (!r) return null;
          const tf = r.fields;
          return {
            id: r.id,
            tokenId: (tf[tokensFields.TOKEN_ID] as string) || "",
            estado: (tf[tokensFields.ESTADO] as string) || "",
            hashFirma: (tf[tokensFields.HASH_FIRMA] as string) || "",
            idEmpleadoCore: (tf[tokensFields.ID_EMPLEADO_CORE] as string) || "",
            fechaGeneracion: (tf[tokensFields.FECHA_GENERACION] as string) || "",
          };
        })
        .filter(Boolean);

      const idEmpleadoCore = (f[entregasFields.ID_EMPLEADO_CORE] as string) || "";

      return {
        id: ent.id,
        idEntrega: (f[entregasFields.ID_ENTREGA] as string) || "",
        fechaEntrega: (f[entregasFields.FECHA_ENTREGA] as string) || "",
        responsable: (f[entregasFields.RESPONSABLE] as string) || "",
        observaciones: (f[entregasFields.OBSERVACIONES] as string) || "",
        fechaConfirmacion: (f[entregasFields.FECHA_CONFIRMACION] as string) || "",
        idEmpleadoCore,
        nombreEmpleado: nombreMap.get(idEmpleadoCore) || "",
        estado: (f[entregasFields.ESTADO] as string) || "",
        motivo: (f[entregasFields.MOTIVO] as string) || "",
        detalles,
        tokens,
      };
    });

    return NextResponse.json({ success: true, data: result, total: result.length });
  } catch (error) {
    console.error("Error fetching entregas:", error);
    return NextResponse.json(
      { success: false, message: "Error al consultar entregas EPP" },
      { status: 500 }
    );
  }
}
