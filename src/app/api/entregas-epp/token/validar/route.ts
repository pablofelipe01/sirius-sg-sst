import { NextRequest, NextResponse } from "next/server";
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
import { airtableInsumosConfig, getInsumosUrl, getInsumosHeaders } from "@/infrastructure/config/airtableInsumos";

interface AirtableListResponse {
  records: {
    id: string;
    fields: Record<string, unknown>;
  }[];
}

/**
 * GET /api/entregas-epp/token/validar?t=TOKEN_HEX
 *
 * Valida el token de entrega EPP y devuelve información para la vista pública.
 * NO requiere autenticación JWT.
 */
export async function GET(request: NextRequest) {
  try {
    const token = request.nextUrl.searchParams.get("t");

    if (!token) {
      return NextResponse.json(
        { success: false, message: "Token requerido" },
        { status: 400 }
      );
    }

    // Validar formato del token (32 caracteres hex)
    if (!/^[A-Fa-f0-9]{32}$/.test(token)) {
      return NextResponse.json(
        { success: false, message: "Formato de token inválido" },
        { status: 400 }
      );
    }

    const headers = getSGSSTHeaders();
    const {
      tokensTableId,
      tokensFields,
      entregasTableId,
      entregasFields,
      detalleTableId,
      detalleFields,
    } = airtableSGSSTConfig;

    // ── 1. Buscar token en Airtable ────────────────────────
    const tokenFormula = `{${tokensFields.TOKEN_ID}}='${token.replace(/'/g, "\\'")}'`;
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
      console.error("[validar] Error fetching token:", await tokenRes.text());
      return NextResponse.json(
        { success: false, message: "Error al validar el token" },
        { status: 500 }
      );
    }

    const tokenData: AirtableListResponse = await tokenRes.json();

    // ── 2. Validar existencia del token ────────────────────
    if (!tokenData.records || tokenData.records.length === 0) {
      return NextResponse.json(
        {
          success: false,
          tokenValido: false,
          message: "Token no encontrado",
        },
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

    // ── 3. Validar expiración ──────────────────────────────
    const ahora = new Date();
    const expiracion = new Date(fechaExpiracion);

    if (ahora > expiracion) {
      return NextResponse.json(
        {
          success: false,
          tokenValido: false,
          message: "Este enlace ha expirado. Solicita uno nuevo al coordinador SST",
        },
        { status: 410 }
      );
    }

    // ── 4. Validar si ya fue usado ─────────────────────────
    const yaFirmado = estado === "Usado" || !!hashFirma;

    if (yaFirmado) {
      return NextResponse.json({
        success: true,
        data: {
          tokenValido: true,
          yaFirmado: true,
          mensaje: "Este enlace ya fue utilizado anteriormente",
        },
      });
    }

    // ── 5. Obtener información de la entrega ───────────────
    if (!entregaLinks || entregaLinks.length === 0) {
      return NextResponse.json(
        {
          success: false,
          tokenValido: false,
          message: "Entrega no vinculada al token",
        },
        { status: 500 }
      );
    }

    const entregaId = entregaLinks[0];
    const entregaRes = await fetch(
      `${getSGSSTUrl(entregasTableId)}/${entregaId}?returnFieldsByFieldId=true`,
      { headers, cache: "no-store" }
    );

    if (!entregaRes.ok) {
      console.error("[validar] Error fetching entrega:", await entregaRes.text());
      return NextResponse.json(
        { success: false, message: "Error al consultar la entrega" },
        { status: 500 }
      );
    }

    const entregaData = await entregaRes.json();
    const ef = entregaData.fields;

    const estadoEntrega = (ef[entregasFields.ESTADO] as string) || "";
    const fechaEntrega = (ef[entregasFields.FECHA_ENTREGA] as string) || "";
    const detalleLinks = (ef[entregasFields.DETALLE_LINK] as string[]) || [];

    // ── 6. Obtener nombre del empleado desde Personal ──────
    let nombreEmpleado = "";
    let documentoMascara = "";

    try {
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

      if (personalRes.ok) {
        const personalData: AirtableListResponse = await personalRes.json();
        if (personalData.records && personalData.records.length > 0) {
          const pf_rec = personalData.records[0].fields;
          nombreEmpleado = (pf_rec[pf.NOMBRE_COMPLETO] as string) || "";
          const numeroDocumento = (pf_rec[pf.NUMERO_DOCUMENTO] as string) || "";

          // Enmascarar cédula: mostrar solo últimos 4 dígitos
          if (numeroDocumento.length > 4) {
            documentoMascara = "*".repeat(numeroDocumento.length - 4) + numeroDocumento.slice(-4);
          } else {
            documentoMascara = numeroDocumento;
          }
        }
      }
    } catch (e) {
      console.error("[validar] Error fetching employee name:", e);
    }

    // ── 7. Obtener detalles de la entrega ──────────────────
    const detalles: {
      nombreInsumo: string;
      cantidad: number;
      talla: string;
    }[] = [];

    if (detalleLinks.length > 0) {
      // Fetch detalles
      const detalleFormula = `OR(${detalleLinks.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
      const detalleParams = new URLSearchParams({
        filterByFormula: detalleFormula,
        returnFieldsByFieldId: "true",
      });

      const detalleRes = await fetch(
        `${getSGSSTUrl(detalleTableId)}?${detalleParams.toString()}`,
        { headers, cache: "no-store" }
      );

      if (detalleRes.ok) {
        const detalleData: AirtableListResponse = await detalleRes.json();

        // Recopilar códigos de insumos
        const codigosInsumo = new Set<string>();
        for (const r of detalleData.records) {
          const codigo = r.fields[detalleFields.CODIGO_INSUMO] as string;
          if (codigo) codigosInsumo.add(codigo);
        }

        // Fetch nombres de insumos desde Insumos Core
        const insumoNombreMap = new Map<string, string>();
        if (codigosInsumo.size > 0) {
          try {
            const { insumoTableId, insumoFields } = airtableInsumosConfig;
            const insHeaders = getInsumosHeaders();

            const insRes = await fetch(
              `${getInsumosUrl(insumoTableId)}?returnFieldsByFieldId=true`,
              { headers: insHeaders, cache: "no-store" }
            );

            if (insRes.ok) {
              const insData: AirtableListResponse = await insRes.json();
              for (const r of insData.records) {
                const codigo = r.fields[insumoFields.CODIGO] as string;
                const nombre = r.fields[insumoFields.NOMBRE] as string;
                if (codigo && nombre) insumoNombreMap.set(codigo, nombre);
              }
            }
          } catch (e) {
            console.error("[validar] Error fetching insumo names:", e);
          }
        }

        // Construir detalles con nombres
        for (const r of detalleData.records) {
          const df = r.fields;
          const codigoInsumo = (df[detalleFields.CODIGO_INSUMO] as string) || "";
          const nombreInsumo = insumoNombreMap.get(codigoInsumo) || codigoInsumo;

          detalles.push({
            nombreInsumo,
            cantidad: (df[detalleFields.CANTIDAD] as number) || 0,
            talla: (df[detalleFields.TALLA] as string) || "Única",
          });
        }
      }
    }

    // ── 8. Construir respuesta ─────────────────────────────
    return NextResponse.json({
      success: true,
      data: {
        tokenValido: true,
        entregaId,
        tokenRecordId: tokenRecord.id,
        fechaEntrega,
        nombreEmpleado,
        documentoMascara,
        idEmpleadoCore,
        estado: estadoEntrega,
        yaFirmado: false,
        detalles,
        fechaExpiracion,
      },
    });
  } catch (error) {
    console.error("[validar] Error validating token:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error interno del servidor",
      },
      { status: 500 }
    );
  }
}
