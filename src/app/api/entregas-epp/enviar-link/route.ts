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

// ── Tipos ───────────────────────────────────────────────
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

interface EnviarLinkBody {
  entregaId: string;                // Record ID de la entrega (recXXX)
  metodo: "email" | "whatsapp";     // Método de envío (futuro)
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
  const filterFormula = `FIND("${entregaId}", ARRAYJOIN({${tokensFields.ENTREGA_LINK}}, ",")) > 0`;
  const params = new URLSearchParams({
    filterByFormula: filterFormula,
    pageSize: "100",
    returnFieldsByFieldId: "true",
    "sort[0][field]": tokensFields.FECHA_GENERACION,
    "sort[0][direction]": "desc",
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
 * Regenera un token si el actual está expirado o usado.
 * Retorna el token activo (existente o nuevo).
 */
async function obtenerORegenerarToken(
  entregaId: string,
  headers: HeadersInit
): Promise<{ tokenId: string; fechaExpiracion: string; regenerado: boolean }> {
  const { tokensTableId, tokensFields, entregasTableId, entregasFields } =
    airtableSGSSTConfig;

  // Buscar token actual
  const tokenActual = await fetchTokenByEntrega(
    entregaId,
    headers,
    tokensTableId,
    tokensFields
  );

  if (!tokenActual) {
    throw new Error("Entrega sin token asociado");
  }

  // Verificar estado del token
  const estadoToken = (tokenActual.fields[tokensFields.ESTADO] as string) || "";
  const fechaExpiracionStr = (tokenActual.fields[
    tokensFields.FECHA_EXPIRACION
  ] as string) || "";
  const fechaExpiracion = new Date(fechaExpiracionStr);
  const ahora = new Date();
  const estaExpirado = fechaExpiracion < ahora;
  const estaUsado = estadoToken === "Usado";
  const estaActivo = estadoToken === "Activo";

  // Si el token está activo y no expirado, retornarlo
  if (estaActivo && !estaExpirado) {
    return {
      tokenId: (tokenActual.fields[tokensFields.TOKEN_ID] as string) || "",
      fechaExpiracion: fechaExpiracionStr,
      regenerado: false,
    };
  }

  // Token expirado o usado → regenerar
  // Marcar token anterior como "Expirado"
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

  // Crear nuevo token (48h validez)
  const nuevoTokenId = generateTokenId();
  const fechaGeneracion = new Date();
  const fechaExpiracionNueva = new Date(
    fechaGeneracion.getTime() + 48 * 60 * 60 * 1000
  );

  const idEmpleadoCore = (tokenActual.fields[
    tokensFields.ID_EMPLEADO_CORE
  ] as string) || "";

  const nuevoTokenFields: Record<string, unknown> = {
    [tokensFields.TOKEN_ID]: nuevoTokenId,
    [tokensFields.FECHA_GENERACION]: fechaGeneracion.toISOString(),
    [tokensFields.FECHA_EXPIRACION]: fechaExpiracionNueva.toISOString(),
    [tokensFields.TIPO_VERIFICACION]: "PIN + Cédula",
    [tokensFields.ENTREGA_LINK]: [entregaId],
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
    throw new Error("Error al crear nuevo token");
  }

  const tokenCreateData = await tokenCreateRes.json();
  const nuevoTokenRecord = tokenCreateData.records[0];

  // Vincular nuevo token a la entrega
  const entregaUrl = `${getSGSSTUrl(entregasTableId)}/${entregaId}?returnFieldsByFieldId=true`;
  const entregaRes = await fetch(entregaUrl, { headers });
  const entregaData: AirtableRecord = await entregaRes.json();
  const tokensLinkActuales = (entregaData.fields[
    entregasFields.TOKENS_LINK
  ] as string[]) || [];

  const nuevosTokensLink = [...tokensLinkActuales, nuevoTokenRecord.id];

  const entregaPatchUrl = `${getSGSSTUrl(entregasTableId)}?returnFieldsByFieldId=true`;
  await fetch(entregaPatchUrl, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      records: [
        {
          id: entregaId,
          fields: {
            [entregasFields.TOKENS_LINK]: nuevosTokensLink,
          },
        },
      ],
    }),
  });

  return {
    tokenId: nuevoTokenId,
    fechaExpiracion: fechaExpiracionNueva.toISOString(),
    regenerado: true,
  };
}

/**
 * Obtiene información del empleado desde la tabla Personal.
 * Retorna email y teléfono si existen.
 */
async function obtenerDatosEmpleado(
  idEmpleado: string
): Promise<{ email: string; telefono: string; nombreCompleto: string }> {
  const { personalTableId, personalFields } = airtableConfig;
  const personalHeaders = getAirtableHeaders();

  // Buscar empleado por ID_EMPLEADO
  const filterFormula = `{${personalFields.ID_EMPLEADO}} = '${idEmpleado.replace(/'/g, "\\'")}'`;
  const params = new URLSearchParams({
    filterByFormula: filterFormula,
    pageSize: "1",
    returnFieldsByFieldId: "true",
  });

  const res = await fetch(
    `${getAirtableUrl(personalTableId)}?${params.toString()}`,
    { headers: personalHeaders }
  );

  if (!res.ok) {
    throw new Error("Error al consultar datos del empleado");
  }

  const data: AirtableListResponse = await res.json();
  if (data.records.length === 0) {
    throw new Error("Empleado no encontrado");
  }

  const empleado = data.records[0].fields;
  return {
    email: (empleado[personalFields.CORREO] as string) || "",
    telefono: (empleado[personalFields.TELEFONO] as string) || "",
    nombreCompleto: (empleado[personalFields.NOMBRE_COMPLETO] as string) || "",
  };
}

/**
 * POST /api/entregas-epp/enviar-link
 *
 * Genera link de firma pública y (futuro) lo envía por email/WhatsApp.
 *
 * Flujo:
 * 1. Validar que entrega existe y está en estado "Pendiente"
 * 2. Obtener token activo de la entrega
 * 3. Si token está expirado o usado → regenerar automáticamente
 * 4. Obtener datos de contacto del empleado
 * 5. Construir URL pública
 * 6. Retornar URL (envío real por email/SMS es futuro)
 */
export async function POST(request: NextRequest) {
  try {
    const body: EnviarLinkBody = await request.json();

    if (!body.entregaId || !body.metodo) {
      return NextResponse.json(
        { success: false, message: "Campos requeridos: entregaId, metodo" },
        { status: 400 }
      );
    }

    if (!/^rec[A-Za-z0-9]{14}$/.test(body.entregaId)) {
      return NextResponse.json(
        { success: false, message: "Formato de entregaId inválido" },
        { status: 400 }
      );
    }

    if (!["email", "whatsapp"].includes(body.metodo)) {
      return NextResponse.json(
        { success: false, message: "Método debe ser 'email' o 'whatsapp'" },
        { status: 400 }
      );
    }

    const headers = getSGSSTHeaders();
    const { entregasTableId, entregasFields } = airtableSGSSTConfig;

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
    const entregaFieldsData = entregaData.fields;

    // Validar que entrega permite firma (Pendiente o Confirmada para actualizar)
    const estadoEntrega = (entregaFieldsData[
      entregasFields.ESTADO
    ] as string) || "";

    if (estadoEntrega !== "Pendiente" && estadoEntrega !== "Confirmada") {
      return NextResponse.json(
        {
          success: false,
          message: `Solo se pueden enviar links de entregas pendientes o confirmadas. Estado actual: ${estadoEntrega}`,
        },
        { status: 400 }
      );
    }

    const idEmpleadoCore = (entregaFieldsData[
      entregasFields.ID_EMPLEADO_CORE
    ] as string) || "";

    if (!idEmpleadoCore) {
      return NextResponse.json(
        { success: false, message: "Entrega sin empleado asociado" },
        { status: 500 }
      );
    }

    // ── 2. Obtener o regenerar token activo ────────────────
    const tokenInfo = await obtenerORegenerarToken(body.entregaId, headers);

    // ── 3. Obtener datos de contacto del empleado ──────────
    const empleadoInfo = await obtenerDatosEmpleado(idEmpleadoCore);

    // ── 4. Construir URL de firma ──────────────────────────
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const urlFirma = `${baseUrl}/firmar/epp?t=${tokenInfo.tokenId}`;

    // Determinar destinatario según método
    const destinatario =
      body.metodo === "email"
        ? empleadoInfo.email || "No disponible"
        : empleadoInfo.telefono || "No disponible";

    // ── 5. (FUTURO) Envío real por email/SMS ───────────────
    // TODO: Integrar con servicio de email (SendGrid, AWS SES, etc.)
    // TODO: Integrar con servicio de WhatsApp (Twilio, etc.)
    // Por ahora, solo retornamos la información

    return NextResponse.json({
      success: true,
      message: tokenInfo.regenerado
        ? "Link generado (token regenerado automáticamente)"
        : "Link generado exitosamente",
      data: {
        url: urlFirma,
        metodo: body.metodo,
        destinatario,
        nombreCompleto: empleadoInfo.nombreCompleto,
        fechaExpiracion: tokenInfo.fechaExpiracion,
        regenerado: tokenInfo.regenerado,
      },
    });
  } catch (error) {
    console.error("Error generating/sending link:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
