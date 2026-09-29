import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
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
import { requireAuth } from "@/lib/authMiddleware";

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
interface AirtableRecord {
  id: string;
  fields: Record<string, unknown>;
}

interface AirtableListResponse {
  records: AirtableRecord[];
  offset?: string;
}

// ══════════════════════════════════════════════════════════
// AES-256-CBC Descifrado
// ══════════════════════════════════════════════════════════
const AES_SECRET = process.env.AES_SIGNATURE_SECRET || "";

function decryptAES(encryptedStr: string): string {
  const [ivB64, encB64] = encryptedStr.split(":");
  if (!ivB64 || !encB64) throw new Error("Formato de cifrado inválido");
  const key = crypto.createHash("sha256").update(AES_SECRET).digest();
  const iv = Buffer.from(ivB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  let dec = decipher.update(encB64, "base64", "utf8");
  dec += decipher.final("utf8");
  return dec;
}

function tryDecryptSignature(hash: string): string {
  if (!hash || !AES_SECRET) return "";
  try {
    const json = JSON.parse(decryptAES(hash));
    return (json.signature as string) || "";
  } catch {
    return "";
  }
}

// ══════════════════════════════════════════════════════════
// Helpers de paginación Airtable
// ══════════════════════════════════════════════════════════
async function fetchAllRecords(
  url: string,
  headers: HeadersInit,
  extraParams: Record<string, string> = {}
): Promise<AirtableRecord[]> {
  const all: AirtableRecord[] = [];
  let offset: string | undefined;
  do {
    const params = new URLSearchParams({
      pageSize: "100",
      returnFieldsByFieldId: "true",
      ...extraParams,
    });
    if (offset) params.set("offset", offset);
    const res = await fetch(`${url}?${params.toString()}`, { headers });
    if (!res.ok) throw new Error(`Airtable error: ${res.status}`);
    const data: AirtableListResponse = await res.json();
    all.push(...data.records);
    offset = data.offset;
  } while (offset);
  return all;
}

async function fetchRecordsByIds(
  url: string,
  headers: HeadersInit,
  ids: string[]
): Promise<Map<string, AirtableRecord>> {
  const map = new Map<string, AirtableRecord>();
  for (let i = 0; i < ids.length; i += 100) {
    const batch = ids.slice(i, i + 100);
    const formula = `OR(${batch.map((id) => `RECORD_ID()='${id}'`).join(",")})`;
    const params = new URLSearchParams({
      filterByFormula: formula,
      pageSize: "100",
      returnFieldsByFieldId: "true",
    });
    const res = await fetch(`${url}?${params.toString()}`, { headers });
    if (res.ok) {
      const data: AirtableListResponse = await res.json();
      for (const r of data.records) map.set(r.id, r);
    }
  }
  return map;
}

// ══════════════════════════════════════════════════════════
// Helpers de formato
// ══════════════════════════════════════════════════════════

/**
 * Parsea el campo AI "Referencia Comercial" de Airtable.
 * Airtable lo devuelve como JSON: {"state":"generated","value":"...","isStale":false}
 */
function parseReferenciaComercial(raw: unknown): string {
  if (!raw) return "—";
  const str = typeof raw === "string" ? raw : JSON.stringify(raw);
  try {
    const parsed = typeof raw === "object" ? raw : JSON.parse(str);
    if (parsed && typeof parsed === "object" && "value" in (parsed as Record<string, unknown>)) {
      let value = String((parsed as Record<string, unknown>).value || "");
      value = value.replace(/^Referencia\s+comercial:\s*/i, "").trim();
      return value || "—";
    }
  } catch {
    /* no es JSON, texto plano */
  }
  return str.trim() || "—";
}

function formatFechaCorta(iso: string): string {
  if (!iso) return "—";
  try {
    const dateStr = iso.includes("T") ? iso : iso + "T12:00:00";
    return new Date(dateStr).toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function formatFechaLarga(iso: string): string {
  if (!iso) return "";
  try {
    const dateStr = iso.includes("T") ? iso : iso + "T12:00:00";
    return new Date(dateStr).toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

function getMesNombre(mes: string): string {
  if (!mes || !/^\d{4}-\d{2}$/.test(mes)) return "";
  const [year, month] = mes.split("-").map(Number);
  return new Date(year, month - 1, 15).toLocaleDateString("es-CO", {
    month: "long",
    year: "numeric",
  });
}

interface Evidencia {
  dataUrl: string;
  ancho: number;
  alto: number;
}

/**
 * Descarga imagen desde URL, corrige orientación EXIF y retorna data URI JPEG
 * con sus dimensiones, para dibujarla sin deformar.
 * sharp.rotate() sin argumentos auto-rota según metadatos EXIF del celular.
 */
async function fetchEvidencia(imageUrl: string): Promise<Evidencia | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const rawBuffer = Buffer.from(await res.arrayBuffer());
    const { data, info } = await sharp(rawBuffer)
      .rotate()
      .resize(500, 500, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer({ resolveWithObject: true });
    return {
      dataUrl: `data:image/jpeg;base64,${data.toString("base64")}`,
      ancho: info.width,
      alto: info.height,
    };
  } catch {
    return null;
  }
}

/**
 * Normaliza una firma a trazo negro sobre fondo transparente.
 * Las firmas del canvas llegan en tres variantes: trazo negro sobre blanco,
 * trazo blanco sobre negro y trazo blanco sobre transparente. Se decide por el
 * brillo promedio de lo visible y luego el trazo se reconstruye en negro, con
 * la opacidad derivada de la luminancia — así el fondo de la fila se conserva.
 */
async function normalizarFirma(dataUrl: string): Promise<string | null> {
  const match = dataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
  if (!match) return null;

  const input = Buffer.from(match[2], "base64");
  try {
    const { data, info } = await sharp(input)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const total = info.width * info.height;
    let visibles = 0;
    let brilloVisible = 0;

    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 30) continue; // pixel transparente
      visibles++;
      brilloVisible += (data[i] + data[i + 1] + data[i + 2]) / 3;
    }

    const mayoriaTransparente = visibles < total * 0.5;
    const promedioVisible = visibles > 0 ? brilloVisible / visibles : 255;
    // Trazo claro sobre fondo transparente, o lienzo mayoritariamente oscuro
    const hayQueInvertir = mayoriaTransparente
      ? promedioVisible > 128
      : promedioVisible < 100;

    const salida = Buffer.alloc(total * 4);
    for (let i = 0; i < data.length; i += 4) {
      const transparente = data[i + 3] < 30;
      let brillo = (data[i] + data[i + 1] + data[i + 2]) / 3;
      if (hayQueInvertir) brillo = 255 - brillo;
      // Un pixel transparente es fondo: cuenta como blanco tras invertir o no
      if (transparente) brillo = 255;

      salida[i] = 0;
      salida[i + 1] = 0;
      salida[i + 2] = 0;
      salida[i + 3] = 255 - Math.round(brillo); // oscuro → opaco
    }

    const png = await sharp(salida, {
      raw: { width: info.width, height: info.height, channels: 4 },
    })
      .png()
      .toBuffer();

    return `data:image/png;base64,${png.toString("base64")}`;
  } catch {
    return dataUrl;
  }
}

// ══════════════════════════════════════════════════════════
// Paleta corporativa sobria — la misma del Excel (exportar/route.ts)
// ══════════════════════════════════════════════════════════
type RGB = [number, number, number];

const BRAND = {
  AZUL_BARRANCA: [31, 61, 92] as RGB, // #1F3D5C — membrete y encabezado
  AZUL_CIELO: [74, 122, 150] as RGB, // #4A7A96 — banda de evidencias
  SUTILEZA: [220, 230, 238] as RGB, // #DCE6EE — franja del acta
  COTILEDON: [245, 248, 250] as RGB, // #F5F8FA — bandas suaves
  IMPERIAL: [46, 58, 70] as RGB, // #2E3A46 — texto de cuerpo
  VERDE_ALEGRIA: [124, 154, 114] as RGB, // #7C9A72 — línea de cierre
  BLANCO: [255, 255, 255] as RGB,
  BORDE: [203, 213, 225] as RGB,
  BORDE_FUERTE: [148, 163, 184] as RGB,
  GRIS_TEXTO: [100, 116, 139] as RGB,
};

// Datos de la empresa (mismas variables que src/lib/pdf/corporativo.ts)
const EMPRESA_RAZON_SOCIAL =
  process.env.EMPRESA_RAZON_SOCIAL || "SIRIUS REGENERATIVE SOLUTIONS S.A.S. ZOMAC";
const EMPRESA_NIT = process.env.EMPRESA_NIT || "901.377.064-8";

const TEXTO_CERTIFICACION =
  "Certifico que recibo a satisfacción los elementos de dotación Personal nombrados anteriormente en buen estado, y haber sido informado de los trabajos y zonas en los que deberá utilizar dicha dotación, así como haber recibido instrucciones para su correcto uso y aceptando los siguientes compromisos.";
const COMPROMISO_A =
  "a) Mantenerlos en buen estado y hacer buen uso de ellos, durante el tiempo de vida útil.";
const COMPROMISO_B =
  "b) Utilizar esta dotación durante la jornada de trabajo en las áreas cuya obligatoriedad de uso se encuentra establecido.";
const NOTA_LEGAL =
  "De acuerdo a lo estipulado en la ley 11/84. Art. 230 establece el deber de todo empleador de suministrar cada cuatro meses, en forma gratuita una dotación (un par de zapatos y un vestido de labor) cuando tenga a su cargo uno o más trabajadores permanentes, cuya remuneración mensual sea hasta dos veces el salario mínimo más alto vigente, y que haya cumplido más de tres meses al servicio de este.";

// ══════════════════════════════════════════════════════════
// GET /api/entregas-epp/exportar-pdf
//
// Query:
//   tipo       epp | dotacion (por defecto dotacion)
//   mes        YYYY-MM — opcional; sin él se toma todo el histórico
//   idEmpleado opcional — todas las entregas de un colaborador
//   entrega    opcional — un solo evento de entrega (ID legible o recordId).
//              En ese modo se incluyen todos sus elementos, sin filtrar por
//              categoría, y el formato se decide por lo que contenga.
//
// Genera el formato FT-SST-023 / FT-SST-029 como una compilación de actas:
// una por entrega, con su fecha, su firma y sus propias evidencias. Con
// `entrega` se emite una sola; sin él, todas las que pasen el filtro,
// agrupadas por trabajador y de la más reciente a la más antigua.
// ══════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  const authResult = await requireAuth(req);
  if (!authResult.authenticated) return authResult.response;

  try {
    const mes = req.nextUrl.searchParams.get("mes");
    const idEmpleadoFilter = req.nextUrl.searchParams.get("idEmpleado");
    const entregaFilter = req.nextUrl.searchParams.get("entrega");
    const tipo = req.nextUrl.searchParams.get("tipo") || "dotacion";
    // Con un evento puntual el tipo se deduce de sus elementos
    let esDotacion = tipo === "dotacion";

    if (mes && !/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json(
        { success: false, message: "El parámetro 'mes' debe tener el formato YYYY-MM" },
        { status: 400 }
      );
    }

    const sgHeaders = getSGSSTHeaders();
    const insHeaders = getInsumosHeaders();
    const authHeaders = getAirtableHeaders();

    const {
      entregasTableId,
      entregasFields,
      detalleTableId,
      detalleFields,
      tokensTableId,
      tokensFields,
    } = airtableSGSSTConfig;

    const { insumoTableId, insumoFields, categoriaTableId, categoriaFields } =
      airtableInsumosConfig;
    const { personalTableId, personalFields } = airtableConfig;

    // ── 1. Filtros ──────────────────────────────────────
    const entregasExtraParams: Record<string, string> = {
      [`sort[0][field]`]: entregasFields.FECHA_ENTREGA,
      [`sort[0][direction]`]: "desc",
    };

    const condiciones: string[] = [];
    if (entregaFilter) {
      const valor = entregaFilter.replace(/'/g, "\\'");
      condiciones.push(
        `OR(RECORD_ID()='${valor}',{${entregasFields.ID_ENTREGA}}='${valor}')`
      );
    }
    if (mes && !entregaFilter) {
      const [year, month] = mes.split("-").map(Number);
      condiciones.push(
        `YEAR({${entregasFields.FECHA_ENTREGA}})=${year}`,
        `MONTH({${entregasFields.FECHA_ENTREGA}})=${month}`
      );
    }
    if (idEmpleadoFilter) {
      condiciones.push(
        `{${entregasFields.ID_EMPLEADO_CORE}}='${idEmpleadoFilter.replace(/'/g, "\\'")}'`
      );
    }
    if (condiciones.length > 0) {
      entregasExtraParams.filterByFormula = `AND(${condiciones.join(",")})`;
    }

    // ── 2. Traer datos en paralelo ──────────────────────
    const [allEntregas, allInsumos, allPersonal, allCategorias] = await Promise.all([
      fetchAllRecords(getSGSSTUrl(entregasTableId), sgHeaders, entregasExtraParams),
      fetchAllRecords(getInsumosUrl(insumoTableId), insHeaders),
      fetchAllRecords(getAirtableUrl(personalTableId), authHeaders),
      fetchAllRecords(getInsumosUrl(categoriaTableId), insHeaders),
    ]);

    if (allEntregas.length === 0) {
      let mensaje: string;
      if (entregaFilter) {
        mensaje = `No se encontró la entrega ${entregaFilter}`;
      } else if (idEmpleadoFilter) {
        mensaje = mes
          ? `Este colaborador no tiene entregas en ${getMesNombre(mes)}`
          : "Este colaborador no tiene entregas registradas";
      } else {
        mensaje = mes
          ? `No hay entregas para ${getMesNombre(mes)}`
          : "No hay entregas registradas";
      }
      return NextResponse.json({ success: false, message: mensaje }, { status: 404 });
    }

    // ── 3. Mapas de lookup ──────────────────────────────
    const categoryTipoMap = new Map<string, string>();
    for (const cat of allCategorias) {
      categoryTipoMap.set(cat.id, (cat.fields[categoriaFields.TIPO] as string) || "");
    }

    const insumoMap = new Map<
      string,
      { nombre: string; referencia: string; categoriaIds: string[] }
    >();
    for (const r of allInsumos) {
      const f = r.fields;
      const codigo = (f[insumoFields.CODIGO] as string) || "";
      insumoMap.set(codigo, {
        nombre: (f[insumoFields.NOMBRE] as string) || codigo,
        referencia: parseReferenciaComercial(f[insumoFields.REFERENCIA_COMERCIAL]),
        categoriaIds: (f[insumoFields.CATEGORIA] as string[]) || [],
      });
    }

    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

    /** Códigos de insumo que pertenecen a una categoría ("epp" | "dotacion"). */
    const codigosDeTipo = (nombreTipo: string): Set<string> => {
      const objetivo = normalize(nombreTipo);
      const codigos = new Set<string>();
      for (const [codigo, info] of insumoMap) {
        const coincide = info.categoriaIds.some(
          (catId) => normalize(categoryTipoMap.get(catId) || "") === objetivo
        );
        if (coincide) codigos.add(codigo);
      }
      return codigos;
    };

    // Con `entrega` no se filtra por categoría: el acta del evento lleva todo
    // lo que se entregó ese día, y el formato se decide después.
    const tipoFilterCodes = entregaFilter ? new Set<string>() : codigosDeTipo(tipo);

    const personalMap = new Map<string, { nombre: string; documento: string }>();
    for (const r of allPersonal) {
      const f = r.fields;
      const idEmp = (f[personalFields.ID_EMPLEADO] as string) || "";
      personalMap.set(idEmp, {
        nombre: (f[personalFields.NOMBRE_COMPLETO] as string) || idEmp,
        documento: (f[personalFields.NUMERO_DOCUMENTO] as string) || "",
      });
    }

    // ── 4. Enlaces de detalle y tokens ──────────────────
    const detalleIds = new Set<string>();
    const tokenIds = new Set<string>();
    for (const ent of allEntregas) {
      const dLinks = ent.fields[entregasFields.DETALLE_LINK] as string[] | undefined;
      const tLinks = ent.fields[entregasFields.TOKENS_LINK] as string[] | undefined;
      dLinks?.forEach((id) => detalleIds.add(id));
      tLinks?.forEach((id) => tokenIds.add(id));
    }

    const [detalleMap, tokenMap] = await Promise.all([
      fetchRecordsByIds(getSGSSTUrl(detalleTableId), sgHeaders, Array.from(detalleIds)),
      fetchRecordsByIds(getSGSSTUrl(tokensTableId), sgHeaders, Array.from(tokenIds)),
    ]);

    // Acta de un evento: si incluye algún elemento de dotación se usa el
    // formato de dotación (con su acta y sus textos de ley); si no, el de EPP.
    if (entregaFilter) {
      const codigosDotacion = codigosDeTipo("dotacion");
      esDotacion = Array.from(detalleMap.values()).some((det) => {
        const codigo = (det.fields[detalleFields.CODIGO_INSUMO] as string) || "";
        return codigosDotacion.has(codigo);
      });
    }

    // ── 5. Un acta por entrega (evento) ──────────────────
    // El documento general es la compilación de las actas individuales: cada
    // entrega conserva su fecha, su firma y sus propias evidencias.
    //
    // Antes se agrupaba por trabajador, y eso rompía las evidencias: todas las
    // entregas del colaborador caían en una sola hoja y solo se conservaban las
    // fotos de la primera entrega que aportara filas, sin forma de saber a qué
    // entrega correspondían. El acta individual (`entrega=…`) es ahora el mismo
    // camino de código con una sola acta.
    interface EntregaRow {
      eppNombre: string;
      cantidad: number;
      referencia: string;
      fechaEntrega: string;
      motivo: string;
      estado: string;
      signatureDataUrl?: string;
    }

    interface Acta {
      idEntrega: string;
      nombre: string;
      documento: string;
      fechaEntrega: string;
      responsable: string;
      observaciones: string;
      rows: EntregaRow[];
      fotoUrls: string[];
    }

    const actas: Acta[] = [];

    for (const ent of allEntregas) {
      const f = ent.fields;
      const idEmp = (f[entregasFields.ID_EMPLEADO_CORE] as string) || "Desconocido";
      const fechaEntrega = (f[entregasFields.FECHA_ENTREGA] as string) || "";
      const motivo = (f[entregasFields.MOTIVO] as string) || "";
      const estado = (f[entregasFields.ESTADO] as string) || "";
      const responsable = (f[entregasFields.RESPONSABLE] as string) || "";
      const observaciones = (f[entregasFields.OBSERVACIONES] as string) || "";

      const empInfo = personalMap.get(idEmp) || { nombre: idEmp, documento: "" };

      // Firma descifrada — se repite en todas las filas de la entrega
      let signatureDataUrl: string | undefined;
      const tLinks = (f[entregasFields.TOKENS_LINK] as string[]) || [];
      for (const tId of tLinks) {
        const tokRec = tokenMap.get(tId);
        if (!tokRec) continue;
        const tf = tokRec.fields;
        const hashFirma = (tf[tokensFields.HASH_FIRMA] as string) || "";
        const tokEstado = (tf[tokensFields.ESTADO] as string) || "";
        if (hashFirma && tokEstado === "Usado") {
          signatureDataUrl = tryDecryptSignature(hashFirma) || undefined;
          break;
        }
      }

      const rows: EntregaRow[] = [];
      const dLinks = (f[entregasFields.DETALLE_LINK] as string[]) || [];
      for (const dId of dLinks) {
        const detRec = detalleMap.get(dId);
        if (!detRec) continue;
        const df = detRec.fields;
        const codigoInsumo = (df[detalleFields.CODIGO_INSUMO] as string) || "";

        // Filtrar por tipo de insumo (EPP / Dotación)
        if (tipoFilterCodes.size > 0 && !tipoFilterCodes.has(codigoInsumo)) continue;

        const insumoInfo = insumoMap.get(codigoInsumo);
        rows.push({
          eppNombre: insumoInfo?.nombre || codigoInsumo || "—",
          cantidad: (df[detalleFields.CANTIDAD] as number) || 0,
          referencia: insumoInfo?.referencia || "—",
          fechaEntrega,
          motivo,
          estado,
          signatureDataUrl,
        });
      }

      // La entrega no aporta elementos de la categoría exportada
      if (rows.length === 0) continue;

      const fotoField = f[entregasFields.FOTO_EVIDENCIA_URL];
      const fotoUrls = Array.isArray(fotoField)
        ? (fotoField as { url?: string }[])
            .map((a) => a?.url)
            .filter((u): u is string => Boolean(u))
        : [];

      actas.push({
        idEntrega: (f[entregasFields.ID_ENTREGA] as string) || ent.id,
        nombre: empInfo.nombre,
        documento: empInfo.documento,
        fechaEntrega,
        responsable,
        observaciones,
        rows,
        fotoUrls,
      });
    }

    // Las actas de un mismo trabajador quedan juntas, de la más reciente a la
    // más antigua.
    actas.sort(
      (a, b) =>
        a.nombre.localeCompare(b.nombre) ||
        (b.fechaEntrega || "").localeCompare(a.fechaEntrega || "")
    );

    const tipoLabel = esDotacion ? "Dotación" : "EPP";
    const codigoFormato = esDotacion ? "FT-SST-023" : "FT-SST-029";

    if (actas.length === 0) {
      if (entregaFilter) {
        return NextResponse.json(
          {
            success: false,
            message: `La entrega ${entregaFilter} no tiene elementos para generar el acta`,
          },
          { status: 404 }
        );
      }
      return NextResponse.json(
        {
          success: false,
          message: `No hay entregas de ${tipoLabel} para el período seleccionado`,
          detail: `Se encontraron ${allEntregas.length} entrega(s) en total, pero ninguna incluye insumos de la categoría '${tipoLabel}'`,
        },
        { status: 404 }
      );
    }

    // ── 6. Precargar imágenes ───────────────────────────
    // Se traen todas las evidencias de cada acta: son la prueba de la entrega y
    // el motivo por el que el acta existe.
    const photoCache = new Map<string, Evidencia>();
    const urls = Array.from(new Set(actas.flatMap((a) => a.fotoUrls)));
    const BATCH = 10;
    for (let i = 0; i < urls.length; i += BATCH) {
      const batch = urls.slice(i, i + BATCH);
      const results = await Promise.all(batch.map((u) => fetchEvidencia(u)));
      batch.forEach((u, idx) => {
        if (results[idx]) photoCache.set(u, results[idx]!);
      });
    }

    // Firmas normalizadas (una sola vez por data URL)
    const firmaCache = new Map<string, string>();
    const firmasUnicas = new Set<string>();
    for (const acta of actas) {
      for (const row of acta.rows) {
        if (row.signatureDataUrl) firmasUnicas.add(row.signatureDataUrl);
      }
    }
    for (const firma of firmasUnicas) {
      const normalizada = await normalizarFirma(firma);
      if (normalizada) firmaCache.set(firma, normalizada);
    }

    // Logo Sirius
    let logoBase64 = "";
    try {
      const logoBuf = fs.readFileSync(path.join(process.cwd(), "public", "logo.png"));
      logoBase64 = `data:image/png;base64,${logoBuf.toString("base64")}`;
    } catch (err) {
      console.warn("No se pudo cargar el logo Sirius:", err);
    }

    // ── 7. Generar PDF ──────────────────────────────────
    const doc = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });
    const PAGE_W = doc.internal.pageSize.getWidth();
    const PAGE_H = doc.internal.pageSize.getHeight();
    const MARGIN = 10;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    // Se reserva el pie de página (número de hoja + código del formato)
    const LIMITE_Y = PAGE_H - MARGIN - 8;

    // Anchos proporcionales a las 5 columnas del Excel (30/11/20/15/38)
    const COL_W = [0.263, 0.096, 0.175, 0.133, 0.333].map((p) =>
      Number((CONTENT_W * p).toFixed(2))
    );

    const setFill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2]);
    const setText = (c: RGB) => doc.setTextColor(c[0], c[1], c[2]);
    const setDraw = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2]);

    /** Barra de una sola celda: fondo + borde + texto. Devuelve la nueva y. */
    const barra = (
      y: number,
      alto: number,
      texto: string,
      opts: {
        fondo?: RGB;
        color?: RGB;
        tamano?: number;
        negrita?: boolean;
        centrado?: boolean;
        subrayado?: boolean;
        x?: number;
        ancho?: number;
      } = {}
    ): number => {
      const x = opts.x ?? MARGIN;
      const ancho = opts.ancho ?? CONTENT_W;
      if (opts.fondo) {
        setFill(opts.fondo);
        doc.rect(x, y, ancho, alto, "F");
      }
      setDraw(BRAND.BORDE);
      doc.setLineWidth(0.2);
      doc.rect(x, y, ancho, alto, "S");

      if (texto) {
        doc.setFont("helvetica", opts.negrita ? "bold" : "normal");
        doc.setFontSize(opts.tamano ?? 9);
        setText(opts.color ?? BRAND.IMPERIAL);
        const ty = y + alto / 2 + (opts.tamano ?? 9) * 0.13;
        if (opts.centrado) {
          doc.text(texto, x + ancho / 2, ty, { align: "center" });
        } else {
          doc.text(texto, x + 2.5, ty);
        }
        if (opts.subrayado) {
          const w = doc.getTextWidth(texto);
          setDraw(opts.color ?? BRAND.IMPERIAL);
          doc.setLineWidth(0.25);
          doc.line(x + 2.5, ty + 1, x + 2.5 + w, ty + 1);
        }
      }
      return y + alto;
    };

    /** Párrafo con fondo opcional, ajustado al ancho del documento. */
    const parrafo = (
      y: number,
      texto: string,
      opts: { fondo?: RGB; tamano?: number; negrita?: boolean; sangria?: number } = {}
    ): number => {
      const tamano = opts.tamano ?? 8;
      const sangria = opts.sangria ?? 0;
      doc.setFont("helvetica", opts.negrita ? "bold" : "normal");
      doc.setFontSize(tamano);
      const lineas = doc.splitTextToSize(texto, CONTENT_W - 6 - sangria) as string[];
      const alto = lineas.length * (tamano * 0.42) + 4;

      if (opts.fondo) {
        setFill(opts.fondo);
        doc.rect(MARGIN, y, CONTENT_W, alto, "F");
      }
      setDraw(BRAND.BORDE);
      doc.setLineWidth(0.2);
      doc.rect(MARGIN, y, CONTENT_W, alto, "S");

      setText(BRAND.IMPERIAL);
      doc.text(lineas, MARGIN + 3 + sangria, y + tamano * 0.42 + 0.6);
      return y + alto;
    };

    let primeraPagina = true;

    for (const acta of actas) {
      // Cada acta arranca en su propia hoja
      if (!primeraPagina) doc.addPage();
      primeraPagina = false;

      let y = MARGIN;

      // ── Encabezado: logo + razón social ───────────────
      const HEAD_H = 15;
      const LOGO_W = COL_W[0];
      setFill(BRAND.AZUL_BARRANCA);
      doc.rect(MARGIN, y, CONTENT_W, HEAD_H, "F");
      if (logoBase64) {
        try {
          const logoH = HEAD_H - 3;
          const logoW = logoH * 2;
          doc.addImage(
            logoBase64,
            "PNG",
            MARGIN + (LOGO_W - logoW) / 2,
            y + 1.5,
            logoW,
            logoH
          );
        } catch (err) {
          console.warn("Error al dibujar el logo:", err);
        }
      }
      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      setText(BRAND.BLANCO);
      doc.text(
        EMPRESA_RAZON_SOCIAL.toUpperCase(),
        MARGIN + LOGO_W + (CONTENT_W - LOGO_W) / 2,
        y + HEAD_H / 2 + 1.4,
        { align: "center", maxWidth: CONTENT_W - LOGO_W - 4 }
      );
      y += HEAD_H;

      // ── NIT + código del formato ──────────────────────
      const anchoNit = COL_W[0] + COL_W[1] + COL_W[2];
      barra(y, 7, `NIT: ${EMPRESA_NIT}`, {
        fondo: BRAND.BLANCO,
        color: BRAND.AZUL_BARRANCA,
        tamano: 8.5,
        centrado: true,
        ancho: anchoNit,
      });
      y = barra(y, 7, `CÓDIGO: ${codigoFormato}`, {
        fondo: BRAND.BLANCO,
        color: BRAND.AZUL_BARRANCA,
        tamano: 8.5,
        negrita: true,
        centrado: true,
        x: MARGIN + anchoNit,
        ancho: CONTENT_W - anchoNit,
      });

      // ── Título del formato ────────────────────────────
      y = barra(
        y,
        10,
        esDotacion
          ? "FORMATO DE ENTREGA DE DOTACIÓN"
          : "FORMATO DE ENTREGA DE ELEMENTOS DE PROTECCIÓN PERSONAL",
        {
          fondo: BRAND.AZUL_BARRANCA,
          color: BRAND.BLANCO,
          tamano: esDotacion ? 12 : 10,
          negrita: true,
          centrado: true,
        }
      );

      // ── Trabajador + documento ────────────────────────
      const anchoNombre = COL_W[0] + COL_W[1] + COL_W[2];
      barra(y, 9, `TRABAJADOR:  ${acta.nombre}`, {
        fondo: BRAND.COTILEDON,
        color: BRAND.AZUL_BARRANCA,
        tamano: 10,
        negrita: true,
        ancho: anchoNombre,
      });
      y = barra(y, 9, `C.C:  ${acta.documento || "—"}`, {
        fondo: BRAND.COTILEDON,
        color: BRAND.AZUL_BARRANCA,
        tamano: 10,
        negrita: true,
        x: MARGIN + anchoNombre,
        ancho: CONTENT_W - anchoNombre,
      });

      // ── Identificación de la entrega ──────────────────
      // Es lo que ata las evidencias de esta hoja a un evento concreto.
      const trazabilidad = [
        `Entrega: ${acta.idEntrega}`,
        formatFechaLarga(acta.fechaEntrega),
        acta.responsable ? `Entregó: ${acta.responsable}` : "",
      ].filter(Boolean);
      y = barra(y, 6, trazabilidad.join("   ·   "), {
        fondo: BRAND.BLANCO,
        color: BRAND.GRIS_TEXTO,
        tamano: 8,
        centrado: true,
      });

      // ── Textos normativos previos (solo dotación) ─────
      if (esDotacion) {
        y = barra(y, 9, "ACTA DE ENTREGA DE DOTACIÓN", {
          fondo: BRAND.SUTILEZA,
          color: BRAND.AZUL_BARRANCA,
          tamano: 11,
          negrita: true,
          centrado: true,
        });

        const fechaCorte = formatFechaLarga(acta.fechaEntrega);
        y = barra(
          y,
          7,
          fechaCorte
            ? `Ref. Entrega de Dotación con Corte ${fechaCorte}.`
            : "Ref. Entrega de Dotación.",
          { tamano: 9, negrita: true, subrayado: true }
        );

        y = barra(
          y,
          7,
          "Por medio de la presente se hace entrega de los siguientes Elementos de Dotación Personal.",
          { tamano: 9 }
        );
      }

      // ── Tabla de elementos entregados ─────────────────
      const hayFirmas = acta.rows.some((r) => r.signatureDataUrl);
      const filas = acta.rows.map((row) => [
        row.eppNombre,
        String(row.cantidad),
        row.referencia,
        formatFechaCorta(row.fechaEntrega),
        row.signatureDataUrl ? "" : row.estado === "Pendiente" ? "Pendiente" : "",
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: MARGIN, right: MARGIN, bottom: MARGIN },
        head: [
          [
            esDotacion ? "DOTACIÓN ENTREGADA" : "EPP ENTREGADO",
            "CANTIDAD",
            "REFERENCIA COMERCIAL",
            "FECHA DE ENTREGA",
            "FIRMA DEL TRABAJADOR",
          ],
        ],
        body: filas,
        theme: "grid",
        styles: {
          font: "helvetica",
          fontSize: 9,
          cellPadding: 1.8,
          lineColor: BRAND.BORDE,
          lineWidth: 0.2,
          textColor: BRAND.IMPERIAL,
          valign: "middle",
          minCellHeight: hayFirmas ? 16 : 7,
        },
        headStyles: {
          fillColor: BRAND.AZUL_BARRANCA,
          textColor: BRAND.BLANCO,
          fontStyle: "bold",
          fontSize: 8, // cabe "CANTIDAD" en una línea con el ancho A4
          halign: "center",
          valign: "middle",
          minCellHeight: 8,
        },
        alternateRowStyles: { fillColor: BRAND.COTILEDON },
        columnStyles: {
          0: { cellWidth: COL_W[0] },
          1: { cellWidth: COL_W[1], halign: "center", fontStyle: "bold", textColor: BRAND.AZUL_BARRANCA },
          2: { cellWidth: COL_W[2], halign: "center", fontSize: 8 },
          3: { cellWidth: COL_W[3], halign: "center", fontSize: 8 },
          4: {
            cellWidth: COL_W[4],
            halign: "center",
            fontSize: 8,
            textColor: BRAND.GRIS_TEXTO,
            fontStyle: "italic",
          },
        },
        didDrawCell: (data) => {
          if (data.section !== "body" || data.column.index !== 4) return;
          const firmaOriginal = acta.rows[data.row.index]?.signatureDataUrl;
          if (!firmaOriginal) return;
          const firma = firmaCache.get(firmaOriginal) || firmaOriginal;
          try {
            const pad = 1;
            const alto = data.cell.height - pad * 2;
            const ancho = Math.min(data.cell.width - pad * 2, alto * 3.5);
            doc.addImage(
              firma,
              "PNG",
              data.cell.x + (data.cell.width - ancho) / 2,
              data.cell.y + pad,
              ancho,
              alto
            );
          } catch (err) {
            console.warn("Error al dibujar la firma:", err);
          }
        },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      y = (doc as any).lastAutoTable.finalY;

      /** Reserva espacio; si no cabe, abre página nueva. */
      const espacio = (alto: number) => {
        if (y + alto > LIMITE_Y) {
          doc.addPage();
          y = MARGIN;
        }
      };

      // ── Textos normativos posteriores (solo dotación) ─
      if (esDotacion) {
        espacio(46);
        y = parrafo(y, TEXTO_CERTIFICACION, { fondo: BRAND.COTILEDON });
        y = parrafo(y, COMPROMISO_A, { sangria: 4 });
        y = parrafo(y, COMPROMISO_B, { sangria: 4 });
        espacio(16);
        y = parrafo(y, NOTA_LEGAL, { fondo: BRAND.SUTILEZA, tamano: 7.5, negrita: true });
      }

      // ── Evidencias fotográficas ───────────────────────
      // Van todas las de esta entrega, en filas de hasta tres. Si no caben en
      // lo que resta de la hoja se abre una nueva y se repite la banda: antes
      // se recortaban a las tres primeras y se descartaban en silencio cuando
      // el espacio libre no alcanzaba.
      const fotos = acta.fotoUrls.filter((u) => photoCache.has(u));

      if (fotos.length > 0) {
        const POR_FILA = 3;
        const GAP = 3;
        const RESERVA_PIE = 12; // el motivo de entrega y la línea de cierre
        const filasFotos: string[][] = [];
        for (let i = 0; i < fotos.length; i += POR_FILA) {
          filasFotos.push(fotos.slice(i, i + POR_FILA));
        }

        let bandaPendiente = true;
        for (const filaFotos of filasFotos) {
          const altoDeseado = filaFotos.length === 1 ? 85 : 62;
          let disponible = LIMITE_Y - y - (bandaPendiente ? 7 : 0) - RESERVA_PIE;

          if (disponible < 30) {
            doc.addPage();
            y = MARGIN;
            bandaPendiente = true;
            disponible = LIMITE_Y - y - 7 - RESERVA_PIE;
          }

          const FOTO_H = Math.min(altoDeseado, disponible);
          if (FOTO_H < 18) break;

          if (bandaPendiente) {
            y = barra(y, 7, `Evidencias Fotográficas (${fotos.length})`, {
              fondo: BRAND.AZUL_CIELO,
              color: BRAND.BLANCO,
              tamano: 9,
              negrita: true,
              centrado: true,
            });
            bandaPendiente = false;
          }

          setDraw(BRAND.BORDE);
          doc.setLineWidth(0.2);
          doc.rect(MARGIN, y, CONTENT_W, FOTO_H, "S");

          const celdaW = (CONTENT_W - GAP * (filaFotos.length + 1)) / filaFotos.length;
          const celdaH = FOTO_H - 4;
          let fx = MARGIN + GAP;
          for (const url of filaFotos) {
            const foto = photoCache.get(url)!;
            try {
              // Contener sin deformar: se escala al lado que primero topa
              const escala = Math.min(celdaW / foto.ancho, celdaH / foto.alto);
              const w = foto.ancho * escala;
              const h = foto.alto * escala;
              doc.addImage(
                foto.dataUrl,
                "JPEG",
                fx + (celdaW - w) / 2,
                y + 2 + (celdaH - h) / 2,
                w,
                h
              );
            } catch (err) {
              console.warn("Error al dibujar la evidencia:", err);
            }
            fx += celdaW + GAP;
          }
          y += FOTO_H;
        }
      }

      // ── Pie: motivo de entrega + línea de acento ──────
      espacio(12);
      const motivos = [...new Set(acta.rows.map((r) => r.motivo).filter(Boolean))];
      y = barra(y, 8, `Motivo de entrega: ${motivos.join(", ") || "—"}`, {
        fondo: BRAND.COTILEDON,
        color: BRAND.AZUL_BARRANCA,
        tamano: 9,
      });

      // ── Observaciones (si existen) ─────────────────────
      if (acta.observaciones) {
        espacio(10);
        y = parrafo(y, `Observaciones: ${acta.observaciones}`, {
          fondo: BRAND.BLANCO,
          tamano: 8.5,
        });
      }

      setFill(BRAND.VERDE_ALEGRIA);
      doc.rect(MARGIN, y, CONTENT_W, 2, "F");
    }

    // ── 8. Pie de página en todas las hojas ─────────────
    const totalPaginas = doc.getNumberOfPages();
    for (let p = 1; p <= totalPaginas; p++) {
      doc.setPage(p);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      setText(BRAND.GRIS_TEXTO);
      doc.text(`Página ${p} de ${totalPaginas}`, PAGE_W / 2, PAGE_H - MARGIN + 1, {
        align: "center",
      });
      doc.text(codigoFormato, PAGE_W - MARGIN, PAGE_H - MARGIN + 1, { align: "right" });
    }

    // ── 9. Retornar PDF ─────────────────────────────────
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    const limpiar = (texto: string) =>
      texto.replace(/\s+/g, "_").replace(/[^\w\-.]/g, "").slice(0, 30);

    const tipoSuffix = esDotacion ? "Dotacion" : "EPP";
    let filename: string;

    if (entregaFilter) {
      // Acta de un evento puntual
      const trabajador = actas[0]?.nombre || "";
      filename = `Acta_${tipoSuffix}_${limpiar(entregaFilter)}${
        trabajador ? `_${limpiar(trabajador)}` : ""
      }.pdf`;
    } else {
      const empleadoLabel = idEmpleadoFilter
        ? `_${limpiar(personalMap.get(idEmpleadoFilter)?.nombre || idEmpleadoFilter)}`
        : "";
      const fileSuffix = mes || "Historico";
      filename = `Entregas_${tipoSuffix}${empleadoLabel}_Sirius_${fileSuffix}.pdf`;
    }

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (error) {
    console.error("Error generando PDF de entregas:", error);
    return NextResponse.json(
      {
        success: false,
        message: error instanceof Error ? error.message : "Error generando PDF",
      },
      { status: 500 }
    );
  }
}
