import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";

// ── Tipos ───────────────────────────────────────────────
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

interface RegenerarTokenBody {
  entregaId: string; // Record ID de la entrega (recXXX)
}

// ── Helpers ─────────────────────────────────────────────
function generateTokenId(): string {
  return crypto.randomBytes(16).toString("hex").toUpperCase();
}

/**
 * Busca el token más reciente asociado a una entrega específica.
 * Retorna null si no se encuentra ningún token vinculado.
 */
async function fetchTokenByEntrega(
  entregaId: string,
  headers: HeadersInit,
  tokensTableId: string,
  tokensFields: typeof airtableSGSSTConfig.tokensFields
): Promise<AirtableRecord | null> {
  // Filtrar tokens vinculados a esta entrega
  const filterFormula = `FIND("${entregaId}", ARRAYJOIN({${tokensFields.ENTREGA_LINK}}, ",")) > 0`;
  const params = new URLSearchParams({
    filterByFormula: filterFormula,
    pageSize: "100",
    returnFieldsByFieldId: "true",
    "sort[0][field]": tokensFields.FECHA_GENERACION,
    "sort[0][direction]": "desc", // Más reciente primero
  });

  const res = await fetch(
    `${getSGSSTUrl(tokensTableId)}?${params.toString()}`,
    { headers }
  );

  if (!res.ok) {
    const err = await res.text();
    console.error("Error fetching tokens:", err);
    throw new Error("Error al consultar tokens");
  }

  const data: AirtableListResponse = await res.json();
  return data.records.length > 0 ? data.records[0] : null;
}

/**
 * POST /api/entregas-epp/regenerar-token
 *
 * Regenera un token de entrega EPP cuando:
 * - El token actual está expirado O ya usado
 * - La entrega está en estado "Pendiente"
 *
 * Flujo:
 * 1. Validar que entrega existe
 * 2. Validar que entrega está en estado "Pendiente"
 * 3. Buscar token actual vinculado
 * 4. Validar que token está expirado o usado (no activo y vigente)
 * 5. Marcar token anterior como "Expirado"
 * 6. Crear nuevo token (48h validez)
 * 7. Vincular nuevo token a la entrega
 * 8. Retornar nuevo tokenId, URL firma y fecha expiración
 */
export async function POST(request: NextRequest) {
  try {
    const body: RegenerarTokenBody = await request.json();

    if (!body.entregaId) {
      return NextResponse.json(
        { success: false, message: "Campo requerido: entregaId" },
        { status: 400 }
      );
    }

    if (!/^rec[A-Za-z0-9]{14}$/.test(body.entregaId)) {
      return NextResponse.json(
        { success: false, message: "Formato de entregaId inválido" },
        { status: 400 }
      );
    }

    const headers = getSGSSTHeaders();
    const {
      entregasTableId,
      entregasFields,
      tokensTableId,
      tokensFields,
    } = airtableSGSSTConfig;

    // ── 1. Verificar que la entrega existe ─────────────────
    const entregaUrl = `${getSGSSTUrl(entregasTableId)}/${body.entregaId}?returnFieldsByFieldId=true`;
    const entregaRes = await fetch(entregaUrl, { headers });

    if (!entregaRes.ok) {
      if (entregaRes.status === 404) {
        return NextResponse.json(
          { success: false, message: "Entrega no encontrada" },
          { status: 404 }
        );
      }
      const err = await entregaRes.text();
      console.error("Error fetching entrega:", err);
      return NextResponse.json(
        { success: false, message: "Error al consultar la entrega" },
        { status: 500 }
      );
    }

    const entregaData: AirtableRecord = await entregaRes.json();
    const entregaFields = entregaData.fields;

    // ── 2. Validar que entrega permite firma ───────────────
    const estadoEntrega = (entregaFields[
      airtableSGSSTConfig.entregasFields.ESTADO
    ] as string) || "";

    if (estadoEntrega !== "Pendiente" && estadoEntrega !== "Confirmada") {
      return NextResponse.json(
        {
          success: false,
          message: `Solo se pueden regenerar tokens de entregas pendientes o confirmadas. Estado actual: ${estadoEntrega}`,
        },
        { status: 400 }
      );
    }

    // ── 3. Buscar token actual vinculado a la entrega ──────
    const tokenActual = await fetchTokenByEntrega(
      body.entregaId,
      headers,
      tokensTableId,
      tokensFields
    );

    if (!tokenActual) {
      return NextResponse.json(
        {
          success: false,
          message: "Entrega sin token asociado",
        },
        { status: 500 }
      );
    }

    // ── 4. Validar estado del token actual ─────────────────
    const estadoToken = (tokenActual.fields[tokensFields.ESTADO] as string) || "";
    const fechaExpiracionStr = (tokenActual.fields[
      tokensFields.FECHA_EXPIRACION
    ] as string) || "";
    const fechaExpiracion = new Date(fechaExpiracionStr);
    const ahora = new Date();
    const estaExpirado = fechaExpiracion < ahora;
    const estaUsado = estadoToken === "Usado";
    const estaActivo = estadoToken === "Activo";

    // Si el token está activo y no expirado, no permitir regeneración
    if (estaActivo && !estaExpirado) {
      const fechaExpiracionLocal = fechaExpiracion.toLocaleString("es-CO", {
        timeZone: "America/Bogota",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      return NextResponse.json(
        {
          success: false,
          message: `El token actual sigue vigente hasta ${fechaExpiracionLocal}`,
        },
        { status: 400 }
      );
    }

    // ── 5. Marcar token anterior como "Expirado" ───────────
    // Solo marcarlo si no está "Usado" (para mantener el historial correcto)
    if (!estaUsado) {
      const tokenPatchUrl = `${getSGSSTUrl(tokensTableId)}?returnFieldsByFieldId=true`;
      await fetch(tokenPatchUrl, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          records: [
            {
              id: tokenActual.id,
              fields: {
                [tokensFields.ESTADO]: "Expirado",
              },
            },
          ],
        }),
      });
    }

    // ── 6. Crear nuevo token (48h validez) ─────────────────
    const nuevoTokenId = generateTokenId();
    const fechaGeneracion = new Date();
    const fechaExpiracionNueva = new Date(
      fechaGeneracion.getTime() + 48 * 60 * 60 * 1000 // 48 horas
    );

    const idEmpleadoCore = (tokenActual.fields[
      tokensFields.ID_EMPLEADO_CORE
    ] as string) || "";

    const nuevoTokenFields: Record<string, unknown> = {
      [tokensFields.TOKEN_ID]: nuevoTokenId,
      [tokensFields.FECHA_GENERACION]: fechaGeneracion.toISOString(),
      [tokensFields.FECHA_EXPIRACION]: fechaExpiracionNueva.toISOString(),
      [tokensFields.TIPO_VERIFICACION]: "PIN + Cédula",
      [tokensFields.ENTREGA_LINK]: [body.entregaId],
      [tokensFields.ID_EMPLEADO_CORE]: idEmpleadoCore,
      [tokensFields.ESTADO]: "Activo",
    };

    const tokenCreateUrl = `${getSGSSTUrl(tokensTableId)}?returnFieldsByFieldId=true`;
    const tokenCreateRes = await fetch(tokenCreateUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        records: [{ fields: nuevoTokenFields }],
        typecast: true,
      }),
    });

    if (!tokenCreateRes.ok) {
      const err = await tokenCreateRes.text();
      console.error("Error creating new token:", err);
      return NextResponse.json(
        { success: false, message: "Error al crear nuevo token" },
        { status: 500 }
      );
    }

    const tokenCreateData = await tokenCreateRes.json();
    const nuevoTokenRecord = tokenCreateData.records[0];

    // ── 7. Vincular nuevo token a la entrega ───────────────
    // Obtener tokens actuales de la entrega
    const tokensLinkActuales = (entregaFields[
      airtableSGSSTConfig.entregasFields.TOKENS_LINK
    ] as string[]) || [];

    // Agregar nuevo token a la lista
    const nuevosTokensLink = [...tokensLinkActuales, nuevoTokenRecord.id];

    const entregaPatchUrl = `${getSGSSTUrl(entregasTableId)}?returnFieldsByFieldId=true`;
    await fetch(entregaPatchUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        records: [
          {
            id: body.entregaId,
            fields: {
              [airtableSGSSTConfig.entregasFields.TOKENS_LINK]: nuevosTokensLink,
            },
          },
        ],
      }),
    });

    // ── 8. Construir URL de firma ──────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const urlFirma = `${baseUrl}/firmar/epp?t=${nuevoTokenId}`;

    return NextResponse.json({
      success: true,
      message: "Token regenerado exitosamente",
      data: {
        nuevoTokenId,
        urlFirma,
        fechaExpiracion: fechaExpiracionNueva.toISOString(),
      },
    });
  } catch (error) {
    console.error("Error regenerating token:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
