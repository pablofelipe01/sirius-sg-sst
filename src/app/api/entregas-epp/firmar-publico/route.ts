import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";
import {
  airtableConfig,
  getAirtableUrl,
  getAirtableHeaders,
} from "@/infrastructure/config/airtable";

// ── AES-256-CBC Encryption ──────────────────────────────
const AES_SECRET = process.env.AES_SIGNATURE_SECRET || "";

function encryptAES(plaintext: string): string {
  // Derivar clave de 32 bytes desde el secreto
  const key = crypto.createHash("sha256").update(AES_SECRET).digest();
  // IV aleatorio de 16 bytes
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");

  // Retornar iv:encrypted en base64
  return iv.toString("base64") + ":" + encrypted;
}

interface FirmaPublicaRequestBody {
  token: string;           // Token HEX del enlace público
  cedula: string;          // Cédula del empleado para validación
  signatureData: string;   // base64 data URL de la firma del canvas
}

interface AirtableListResponse {
  records: {
    id: string;
    fields: Record<string, unknown>;
  }[];
}

/**
 * POST /api/entregas-epp/firmar-publico
 *
 * Endpoint público (SIN autenticación JWT) para firma de entregas EPP.
 *
 * Flujo de validaciones:
 * 1. Token existe en tabla "Tokens Entrega"
 * 2. Token no está usado (ESTADO != "Usado")
 * 3. Token no está expirado (FECHA_EXPIRACION > now)
 * 4. Cédula coincide con empleado vinculado al token
 * 5. Entrega existe y está en estado "Pendiente"
 *
 * Luego:
 * 1. Encripta la firma con AES-256-CBC
 * 2. Actualiza el Token con Hash Firma y Estado "Usado"
 * 3. Actualiza la Entrega con Estado "Confirmada" y Fecha Confirmación
 */
export async function POST(request: NextRequest) {
  try {
    const body: FirmaPublicaRequestBody = await request.json();

    // ── Validación inicial de campos ───────────────────────
    if (!body.token || !body.cedula || !body.signatureData) {
      return NextResponse.json(
        { success: false, message: "Campos requeridos: token, cedula, signatureData" },
        { status: 400 }
      );
    }

    // Validar formato del token (32 caracteres hex)
    if (!/^[A-Fa-f0-9]{32}$/.test(body.token)) {
      return NextResponse.json(
        { success: false, message: "Formato de token inválido" },
        { status: 400 }
      );
    }

    if (!AES_SECRET) {
      console.error("[firmar-publico] AES_SIGNATURE_SECRET no configurado");
      return NextResponse.json(
        { success: false, message: "Error de configuración del servidor" },
        { status: 500 }
      );
    }

    const headers = getSGSSTHeaders();
    const {
      tokensTableId,
      tokensFields,
      entregasTableId,
      entregasFields,
    } = airtableSGSSTConfig;

    // ── 1. Buscar token en Airtable ────────────────────────
    const tokenFormula = `{${tokensFields.TOKEN_ID}}='${body.token.replace(/'/g, "\\'")}'`;
    const tokenParams = new URLSearchParams({
      filterByFormula: tokenFormula,
      returnFieldsByFieldId: "true",
      maxRecords: "1",
    });

    const tokenRes = await fetch(
      `${getSGSSTUrl(tokensTableId)}?${tokenParams.toString()}`,
      { headers, cache: "no-store" }
    );

    if (!tokenRes.ok) {
      const err = await tokenRes.text();
      console.error("[firmar-publico] Error fetching token:", tokenRes.status, err);
      return NextResponse.json(
        { success: false, message: "Error al validar el token" },
        { status: 500 }
      );
    }

    const tokenData: AirtableListResponse = await tokenRes.json();

    // ── 2. Validar existencia del token ────────────────────
    if (!tokenData.records || tokenData.records.length === 0) {
      console.error(`[firmar-publico] ${new Date().toISOString()} - Token no encontrado: ${body.token}`);
      return NextResponse.json(
        { success: false, message: "Token no encontrado" },
        { status: 404 }
      );
    }

    const tokenRecord = tokenData.records[0];
    const tf = tokenRecord.fields;

    const estado = (tf[tokensFields.ESTADO] as string) || "";
    const fechaExpiracion = (tf[tokensFields.FECHA_EXPIRACION] as string) || "";
    const entregaLinks = (tf[tokensFields.ENTREGA_LINK] as string[]) || [];
    const idEmpleadoCore = (tf[tokensFields.ID_EMPLEADO_CORE] as string) || "";
    const hashFirma = (tf[tokensFields.HASH_FIRMA] as string) || "";

    // ── 3. Validar que token no esté usado ─────────────────
    if (estado === "Usado" || !!hashFirma) {
      console.error(`[firmar-publico] ${new Date().toISOString()} - Token ya usado: ${body.token}`);
      return NextResponse.json(
        { success: false, message: "Este enlace ya fue utilizado" },
        { status: 400 }
      );
    }

    // ── 4. Validar que token no esté expirado ──────────────
    const ahora = new Date();
    const expiracion = new Date(fechaExpiracion);

    if (ahora > expiracion) {
      console.error(`[firmar-publico] ${new Date().toISOString()} - Token expirado: ${body.token} (exp: ${fechaExpiracion})`);
      return NextResponse.json(
        { success: false, message: "Este enlace ha expirado. Solicita uno nuevo al coordinador SST" },
        { status: 410 }
      );
    }

    // ── 5. Validar cédula del empleado ─────────────────────
    // Buscar empleado en Personal por ID_EMPLEADO y verificar cédula
    const { personalTableId, personalFields: pf } = airtableConfig;
    const personalFormula = `{${pf.ID_EMPLEADO}}='${idEmpleadoCore.replace(/'/g, "\\'")}'`;
    const personalParams = new URLSearchParams({
      filterByFormula: personalFormula,
      returnFieldsByFieldId: "true",
      maxRecords: "1",
    });

    const personalRes = await fetch(
      `${getAirtableUrl(personalTableId)}?${personalParams.toString()}`,
      { headers: getAirtableHeaders(), cache: "no-store" }
    );

    if (!personalRes.ok) {
      console.error("[firmar-publico] Error fetching employee:", await personalRes.text());
      return NextResponse.json(
        { success: false, message: "Error al validar el empleado" },
        { status: 500 }
      );
    }

    const personalData: AirtableListResponse = await personalRes.json();

    if (!personalData.records || personalData.records.length === 0) {
      console.error(`[firmar-publico] ${new Date().toISOString()} - Empleado no encontrado: ${idEmpleadoCore}`);
      return NextResponse.json(
        { success: false, message: "Empleado no encontrado" },
        { status: 500 }
      );
    }

    const empleado = personalData.records[0].fields;
    const numeroDocumento = (empleado[pf.NUMERO_DOCUMENTO] as string) || "";
    const nombreCompleto = (empleado[pf.NOMBRE_COMPLETO] as string) || "";

    if (numeroDocumento !== body.cedula) {
      console.error(`[firmar-publico] ${new Date().toISOString()} - Cédula incorrecta para empleado ${idEmpleadoCore}: esperada ${numeroDocumento}, recibida ${body.cedula}`);
      return NextResponse.json(
        { success: false, message: "Número de documento incorrecto" },
        { status: 403 }
      );
    }

    // ── 6. Validar estado de la entrega ────────────────────
    if (!entregaLinks || entregaLinks.length === 0) {
      console.error(`[firmar-publico] ${new Date().toISOString()} - Token sin entrega vinculada: ${body.token}`);
      return NextResponse.json(
        { success: false, message: "Token sin entrega vinculada" },
        { status: 500 }
      );
    }

    const entregaId = entregaLinks[0];
    const entregaRes = await fetch(
      `${getSGSSTUrl(entregasTableId)}/${entregaId}?returnFieldsByFieldId=true`,
      { headers, cache: "no-store" }
    );

    if (!entregaRes.ok) {
      console.error("[firmar-publico] Error fetching entrega:", await entregaRes.text());
      return NextResponse.json(
        { success: false, message: "Error al consultar la entrega" },
        { status: 500 }
      );
    }

    const entregaData = await entregaRes.json();
    const ef = entregaData.fields;
    const estadoEntrega = (ef[entregasFields.ESTADO] as string) || "";

    if (estadoEntrega !== "Pendiente" && estadoEntrega !== "Confirmada") {
      console.error(`[firmar-publico] ${new Date().toISOString()} - Entrega no firmable: ${entregaId} (estado: ${estadoEntrega})`);
      return NextResponse.json(
        { success: false, message: "Esta entrega no permite firma. Estado actual: " + estadoEntrega },
        { status: 400 }
      );
    }

    const esActualizacion = estadoEntrega === "Confirmada";

    // ── 7. Encriptar firma con AES ──────────────────────────
    const firmaPayload = JSON.stringify({
      signature: body.signatureData,
      employee: idEmpleadoCore,
      employeeName: nombreCompleto,
      document: body.cedula,
      timestamp: new Date().toISOString(),
      tokenRecord: tokenRecord.id,
      source: esActualizacion ? "public-link-update" : "public-link",
    });

    const encryptedSignature = encryptAES(firmaPayload);

    // ── 8. Actualizar Token Entrega ─────────────────────────
    const tokenPatchUrl = `${getSGSSTUrl(tokensTableId)}?returnFieldsByFieldId=true`;
    const tokenPatchRes = await fetch(tokenPatchUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        records: [
          {
            id: tokenRecord.id,
            fields: {
              [tokensFields.HASH_FIRMA]: encryptedSignature,
              [tokensFields.ESTADO]: "Usado",
            },
          },
        ],
      }),
    });

    if (!tokenPatchRes.ok) {
      const err = await tokenPatchRes.text();
      console.error("[firmar-publico] Error updating token:", err);
      return NextResponse.json(
        { success: false, message: "Error al actualizar el token de firma" },
        { status: 500 }
      );
    }

    // ── 9. Actualizar Entrega EPP ───────────────────────────
    // Solo actualizar estado si la entrega está pendiente (primera firma)
    // Si ya está confirmada (actualización de firma), no cambiar estado
    const hoy = new Date().toLocaleDateString("en-CA", { timeZone: "America/Bogota" });

    if (!esActualizacion) {
      const entregaPatchUrl = `${getSGSSTUrl(entregasTableId)}?returnFieldsByFieldId=true`;
      const entregaPatchRes = await fetch(entregaPatchUrl, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          records: [
            {
              id: entregaId,
              fields: {
                [entregasFields.ESTADO]: "Confirmada",
                [entregasFields.FECHA_CONFIRMACION]: hoy,
              },
            },
          ],
        }),
      });

      if (!entregaPatchRes.ok) {
        const err = await entregaPatchRes.text();
        console.error("[firmar-publico] Error updating entrega:", err);
        return NextResponse.json(
          { success: false, message: "Error al confirmar la entrega" },
          { status: 500 }
        );
      }
    }

    const accion = esActualizacion ? "Firma actualizada" : "Firma exitosa";
    console.log(`[firmar-publico] ${new Date().toISOString()} - ${accion}: entrega ${entregaId}, empleado ${nombreCompleto} (${body.cedula})`);

    return NextResponse.json({
      success: true,
      message: esActualizacion
        ? "Firma actualizada exitosamente"
        : "Firma registrada y entrega confirmada exitosamente",
    });
  } catch (error) {
    console.error("[firmar-publico] Error processing firma:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
