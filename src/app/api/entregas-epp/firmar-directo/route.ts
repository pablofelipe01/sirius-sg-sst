import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import {
  airtableSGSSTConfig,
  getSGSSTUrl,
  getSGSSTHeaders,
} from "@/infrastructure/config/airtableSGSST";

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

/**
 * POST /api/entregas-epp/firmar-directo
 *
 * Permite cargar o actualizar la firma de una entrega directamente
 * desde el panel de administración, sin necesidad de generar tokens ni links.
 *
 * 1. Busca el token más reciente de la entrega (o crea uno interno)
 * 2. Encripta la firma con AES-256-CBC
 * 3. Actualiza el token con la firma
 * 4. Si la entrega estaba Pendiente, la pasa a Confirmada
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { entregaId, signatureData } = body as {
      entregaId: string;
      signatureData: string;
    };

    // ── Validaciones ────────────────────────────────────
    if (!entregaId || !signatureData) {
      return NextResponse.json(
        { success: false, message: "Campos requeridos: entregaId, signatureData" },
        { status: 400 }
      );
    }

    if (!/^rec[A-Za-z0-9]{14}$/.test(entregaId)) {
      return NextResponse.json(
        { success: false, message: "ID de entrega inválido" },
        { status: 400 }
      );
    }

    if (!signatureData.startsWith("data:image/")) {
      return NextResponse.json(
        { success: false, message: "Formato de firma inválido" },
        { status: 400 }
      );
    }

    if (!AES_SECRET) {
      console.error("[firmar-directo] AES_SIGNATURE_SECRET no configurado");
      return NextResponse.json(
        { success: false, message: "Error de configuración del servidor" },
        { status: 500 }
      );
    }

    const headers = getSGSSTHeaders();
    const {
      entregasTableId,
      entregasFields,
      tokensTableId,
      tokensFields,
    } = airtableSGSSTConfig;

    // ── 1. Obtener la entrega ───────────────────────────
    const entregaUrl = `${getSGSSTUrl(entregasTableId)}/${entregaId}?returnFieldsByFieldId=true`;
    const entregaRes = await fetch(entregaUrl, { headers });

    if (!entregaRes.ok) {
      return NextResponse.json(
        { success: false, message: "Entrega no encontrada" },
        { status: 404 }
      );
    }

    const entregaData = await entregaRes.json();
    const ef = entregaData.fields;
    const estado = (ef[entregasFields.ESTADO] as string) || "";
    const idEmpleadoCore = (ef[entregasFields.ID_EMPLEADO_CORE] as string) || "";
    const tokensLink = (ef[entregasFields.TOKENS_LINK] as string[]) || [];

    const estadosPermitidos = ["Pendiente", "Confirmada"];
    if (!estadosPermitidos.includes(estado)) {
      return NextResponse.json(
        { success: false, message: `No se puede firmar una entrega con estado "${estado}"` },
        { status: 400 }
      );
    }

    // ── 2. Buscar token más reciente o crear uno ────────
    let tokenRecordId: string | null = null;

    if (tokensLink.length > 0) {
      // Buscar el token más reciente
      const formula = `OR(${tokensLink.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
      const tokensUrl = `${getSGSSTUrl(tokensTableId)}?filterByFormula=${encodeURIComponent(formula)}&sort%5B0%5D%5Bfield%5D=${tokensFields.FECHA_GENERACION}&sort%5B0%5D%5Bdirection%5D=desc&maxRecords=1&returnFieldsByFieldId=true`;
      const tokensRes = await fetch(tokensUrl, { headers });

      if (tokensRes.ok) {
        const tokensData = await tokensRes.json();
        if (tokensData.records?.[0]) {
          tokenRecordId = tokensData.records[0].id;
        }
      }
    }

    // Si no hay token, crear uno interno (nunca será usado como link)
    if (!tokenRecordId) {
      const tokenId = crypto.randomBytes(16).toString("hex").toUpperCase();
      const ahora = new Date().toISOString();

      const createRes = await fetch(getSGSSTUrl(tokensTableId), {
        method: "POST",
        headers,
        body: JSON.stringify({
          records: [
            {
              fields: {
                [tokensFields.TOKEN_ID]: tokenId,
                [tokensFields.FECHA_GENERACION]: ahora,
                [tokensFields.FECHA_EXPIRACION]: ahora, // No aplica, firma directa
                [tokensFields.TIPO_VERIFICACION]: "Firma directa",
                [tokensFields.ENTREGA_LINK]: [entregaId],
                [tokensFields.ID_EMPLEADO_CORE]: idEmpleadoCore,
                [tokensFields.ESTADO]: "Usado",
              },
            },
          ],
        }),
      });

      if (!createRes.ok) {
        const err = await createRes.text();
        console.error("[firmar-directo] Error creando token:", err);
        return NextResponse.json(
          { success: false, message: "Error interno al registrar firma" },
          { status: 500 }
        );
      }

      const createData = await createRes.json();
      tokenRecordId = createData.records[0].id;

      // Vincular token a la entrega
      const currentTokens = tokensLink || [];
      await fetch(`${getSGSSTUrl(entregasTableId)}?returnFieldsByFieldId=true`, {
        method: "PATCH",
        headers,
        body: JSON.stringify({
          records: [
            {
              id: entregaId,
              fields: {
                [entregasFields.TOKENS_LINK]: [...currentTokens, tokenRecordId],
              },
            },
          ],
        }),
      });
    }

    // ── 3. Encriptar firma con AES-256-CBC ──────────────
    const firmaPayload = JSON.stringify({
      signature: signatureData,
      employee: idEmpleadoCore,
      document: "",
      timestamp: new Date().toISOString(),
      tokenRecord: tokenRecordId,
      source: "firma-directa-admin",
    });

    const encryptedSignature = encryptAES(firmaPayload);

    // ── 4. Actualizar token con firma encriptada ────────
    const tokenPatchUrl = `${getSGSSTUrl(tokensTableId)}?returnFieldsByFieldId=true`;
    const tokenPatchRes = await fetch(tokenPatchUrl, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        records: [
          {
            id: tokenRecordId,
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
      console.error("[firmar-directo] Error actualizando token:", err);
      return NextResponse.json(
        { success: false, message: "Error al guardar la firma" },
        { status: 500 }
      );
    }

    // ── 5. Si estaba Pendiente, confirmar entrega ───────
    if (estado === "Pendiente") {
      const hoy = new Date().toLocaleDateString("en-CA", {
        timeZone: "America/Bogota",
      });

      await fetch(`${getSGSSTUrl(entregasTableId)}?returnFieldsByFieldId=true`, {
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
    }

    return NextResponse.json({
      success: true,
      message:
        estado === "Confirmada"
          ? "Firma actualizada exitosamente"
          : "Firma registrada y entrega confirmada exitosamente",
    });
  } catch (error) {
    console.error("[firmar-directo] Error:", error);
    return NextResponse.json(
      {
        success: false,
        message:
          error instanceof Error
            ? error.message
            : "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
