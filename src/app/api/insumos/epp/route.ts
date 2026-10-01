import { NextResponse } from "next/server";
import {
  airtableInsumosConfig,
  getInsumosUrl,
  getInsumosHeaders,
} from "@/infrastructure/config/airtableInsumos";

const { insumoFields } = airtableInsumosConfig;

// Tipos para la respuesta de Airtable
interface AirtableAttachment {
  id: string;
  url: string;
  filename: string;
  width?: number;
  height?: number;
  thumbnails?: {
    small?: { url: string; width: number; height: number };
    large?: { url: string; width: number; height: number };
  };
}

interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

// Tipo normalizado que exponemos al frontend
export interface InsumoEPP {
  id: string;
  codigo: string;
  nombre: string;
  unidadMedida: string;
  stockMinimo: number;
  stockActual: number;
  estado: string;
  imagen: { url: string; filename: string; width?: number; height?: number } | null;
  referenciaComercial: string;
  responsable: string;
  categoriaIds: string[];
}

/**
 * Calcula stock actual por insumo a partir de los movimientos.
 * Entrada (+), Salida (-), Ajuste (valor directo que reemplaza — por simplicidad se suma).
 */
async function calcularStockDesdeMovimientos(
  insumoIds: string[]
): Promise<Map<string, number>> {
  const stockMap = new Map<string, number>();
  if (insumoIds.length === 0) return stockMap;

  // Inicializar todos en 0
  for (const id of insumoIds) stockMap.set(id, 0);

  const { movimientosTableId, movimientosFields } = airtableInsumosConfig;
  const url = getInsumosUrl(movimientosTableId);
  const headers = getInsumosHeaders();

  let offset: string | undefined;

  try {
    do {
      const params = new URLSearchParams({
        pageSize: "100",
        returnFieldsByFieldId: "true",
      });
      if (offset) params.set("offset", offset);

      const response = await fetch(`${url}?${params.toString()}`, { headers });
      if (!response.ok) break;

      const data: AirtableListResponse = await response.json();

      for (const record of data.records) {
        const f = record.fields;
        const linkedInsumos = f[movimientosFields.INSUMO] as string[] | undefined;
        const cantidad = (f[movimientosFields.CANTIDAD] as number) || 0;
        const tipo = (f[movimientosFields.TIPO] as string) || "";

        if (!linkedInsumos?.[0]) continue;
        const insumoId = linkedInsumos[0];

        if (!stockMap.has(insumoId)) continue;

        const current = stockMap.get(insumoId) || 0;
        if (tipo === "Entrada") {
          stockMap.set(insumoId, current + cantidad);
        } else if (tipo === "Salida") {
          stockMap.set(insumoId, current - cantidad);
        } else if (tipo === "Ajuste") {
          stockMap.set(insumoId, current + cantidad);
        }
      }

      offset = data.offset;
    } while (offset);
  } catch (error) {
    console.error("Error calculating stock from movements:", error);
  }

  return stockMap;
}

/**
 * POST /api/insumos/epp
 * Crea un nuevo insumo EPP en Airtable.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      nombre,
      unidadMedida,
      stockMinimo,
      referenciaComercial,
      categoria,
      responsable,
      idAreaOrigen,
      fichaTecnica,
      areasConsumidoras
    } = body;

    // Validaciones
    if (!nombre || !unidadMedida) {
      return NextResponse.json(
        { success: false, message: "Nombre y unidad de medida son obligatorios" },
        { status: 400 }
      );
    }

    const { insumoTableId, eppCategoryRecordId, dotacionCategoryRecordId } = airtableInsumosConfig;
    const url = getInsumosUrl(insumoTableId);
    const headers = getInsumosHeaders();

    // Determinar categoría (EPP por defecto, o Dotación si se especifica)
    let categoriaId = eppCategoryRecordId;
    if (categoria === "Dotación" && dotacionCategoryRecordId) {
      categoriaId = dotacionCategoryRecordId;
    }

    // Crear el registro en Airtable
    const fields: Record<string, unknown> = {
      [insumoFields.NOMBRE]: nombre,
      [insumoFields.UNIDAD_MEDIDA]: unidadMedida,
      [insumoFields.STOCK_MINIMO]: stockMinimo || 0,
      [insumoFields.ESTADO]: "Activo",
      [insumoFields.CATEGORIA]: [categoriaId],
    };

    // Agregar campos opcionales si se proporcionaron
    if (referenciaComercial && referenciaComercial.trim()) {
      fields[insumoFields.REFERENCIA_COMERCIAL] = referenciaComercial;
    }

    if (responsable && responsable.trim()) {
      fields[insumoFields.RESPONSABLE] = responsable;
    }

    if (idAreaOrigen && idAreaOrigen.trim()) {
      fields[insumoFields.ID_AREA_ORIGEN] = idAreaOrigen;
    }

    if (fichaTecnica && fichaTecnica.trim()) {
      fields[insumoFields.FICHA_TECNICA] = fichaTecnica;
    }

    if (areasConsumidoras && Array.isArray(areasConsumidoras) && areasConsumidoras.length > 0) {
      fields[insumoFields.AREAS_CONSUMIDORAS] = areasConsumidoras;
    }

    const payload = {
      records: [{ fields }],
      typecast: true,
    };

    const response = await fetch(`${url}?returnFieldsByFieldId=true`, {
      method: "POST",
      headers,
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Airtable API error:", response.status, errorText);
      console.error("Payload enviado:", JSON.stringify(payload, null, 2));

      // Intentar parsear el error de Airtable para dar más detalles
      let errorDetails = "Error al crear el insumo en Airtable";
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.error?.message || errorDetails;
      } catch {
        // Si no se puede parsear, usar el texto completo
        errorDetails = errorText || errorDetails;
      }

      return NextResponse.json(
        { success: false, message: errorDetails },
        { status: 500 }
      );
    }

    const data = await response.json();
    const created = data.records?.[0];

    if (!created) {
      return NextResponse.json(
        { success: false, message: "No se pudo crear el registro en Airtable" },
        { status: 500 }
      );
    }

    const f = created.fields;

    // Retornar el insumo creado en formato normalizado
    const nuevoInsumo: InsumoEPP = {
      id: created.id,
      codigo: (f[insumoFields.CODIGO] as string) || "",
      nombre: (f[insumoFields.NOMBRE] as string) || "",
      unidadMedida: (f[insumoFields.UNIDAD_MEDIDA] as string) || "",
      stockMinimo: (f[insumoFields.STOCK_MINIMO] as number) || 0,
      stockActual: 0,
      estado: (f[insumoFields.ESTADO] as string) || "Activo",
      imagen: null,
      referenciaComercial: (f[insumoFields.REFERENCIA_COMERCIAL] as { value: string } | undefined)?.value || "",
      responsable: (f[insumoFields.RESPONSABLE] as string) || "",
      categoriaIds: (f[insumoFields.CATEGORIA] as string[]) || [],
    };

    return NextResponse.json({ success: true, data: nuevoInsumo });
  } catch (error) {
    console.error("Error creating EPP insumo:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/insumos/epp
 * Devuelve todos los insumos de categoría EPP y Dotación desde Airtable (Sirius Insumos Core).
 * Filtra por estado activo en Airtable y por categoría EPP/Dotación en el servidor.
 */
export async function GET() {
  try {
    const { insumoTableId, eppCategoryRecordId, dotacionCategoryRecordId } = airtableInsumosConfig;
    const allowedCategories = [eppCategoryRecordId, dotacionCategoryRecordId].filter(Boolean);
    const url = getInsumosUrl(insumoTableId);
    const headers = getInsumosHeaders();

    // Solo filtrar por estado activo (el filtro de linked records no funciona con ARRAYJOIN en la API)
    const filterFormula = `{Estado Insumo} = 'Activo'`;

    let allRecords: AirtableRecord[] = [];
    let offset: string | undefined;

    // Paginar todos los resultados
    do {
      const params = new URLSearchParams({
        filterByFormula: filterFormula,
        pageSize: "100",
        returnFieldsByFieldId: "true",
      });
      if (offset) params.set("offset", offset);

      const response = await fetch(`${url}?${params.toString()}`, { headers });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Airtable API error:", response.status, errorText);
        return NextResponse.json(
          { success: false, message: "Error al consultar inventario de insumos" },
          { status: 500 }
        );
      }

      const data: AirtableListResponse = await response.json();
      allRecords = [...allRecords, ...data.records];
      offset = data.offset;
    } while (offset);

    // Filtrar insumos que pertenecen a EPP o Dotación (server-side)
    const eppRecords = allRecords.filter((record) => {
      const categorias = record.fields[insumoFields.CATEGORIA] as string[] | undefined;
      return categorias?.some((catId) => allowedCategories.includes(catId));
    });

    // ── Calcular stock actual desde Movimientos ───────────
    const stockMap = await calcularStockDesdeMovimientos(eppRecords.map((r) => r.id));

    // Mapear registros a nuestro tipo normalizado
    const insumos: InsumoEPP[] = eppRecords.map((record) => {
      const f = record.fields;
      const imagenes = f[insumoFields.IMAGEN] as AirtableAttachment[] | undefined;
      const refComercial = f[insumoFields.REFERENCIA_COMERCIAL] as
        | { state: string; value: string }
        | undefined;

      return {
        id: record.id,
        codigo: (f[insumoFields.CODIGO] as string) || "",
        nombre: (f[insumoFields.NOMBRE] as string) || "",
        unidadMedida: (f[insumoFields.UNIDAD_MEDIDA] as string) || "",
        stockMinimo: (f[insumoFields.STOCK_MINIMO] as number) || 0,
        stockActual: stockMap.get(record.id) || 0,
        estado: (f[insumoFields.ESTADO] as string) || "Activo",
        imagen: imagenes?.[0]
          ? {
              url: imagenes[0].thumbnails?.large?.url || imagenes[0].url,
              filename: imagenes[0].filename,
              width: imagenes[0].thumbnails?.large?.width || imagenes[0].width,
              height: imagenes[0].thumbnails?.large?.height || imagenes[0].height,
            }
          : null,
        referenciaComercial: refComercial?.value || "",
        responsable: (f[insumoFields.RESPONSABLE] as string) || "",
        categoriaIds: (f[insumoFields.CATEGORIA] as string[]) || [],
      };
    });

    return NextResponse.json({ success: true, data: insumos, total: insumos.length });
  } catch (error) {
    console.error("Error fetching EPP insumos:", error);
    return NextResponse.json(
      { success: false, message: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
