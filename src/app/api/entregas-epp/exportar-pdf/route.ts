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
// Helpers
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
  } catch { /* plain text */ }
  return str.trim() || "—";
}

function formatFechaColombia(iso: string): string {
  if (!iso) return "—";
  try {
    const dateStr = iso.includes("T") ? iso : iso + "T12:00:00";
    return new Date(dateStr).toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      day: "2-digit",
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
  const date = new Date(year, month - 1, 15);
  return date.toLocaleDateString("es-CO", { month: "long", year: "numeric" });
}

/**
 * Descarga imagen desde URL, corrige orientación EXIF y retorna base64 data URI para jsPDF.
 * sharp.rotate() sin argumentos auto-rota según metadatos EXIF del celular.
 */
async function fetchImageAsBase64(imageUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(imageUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return null;
    const rawBuffer = Buffer.from(await res.arrayBuffer());
    // Auto-rotar según EXIF, reducir resolución y convertir a JPEG
    const correctedBuffer = await sharp(rawBuffer)
      .rotate() // auto-rotate based on EXIF orientation
      .resize(800, 800, { fit: "inside", withoutEnlargement: true })
      .jpeg({ quality: 82 })
      .toBuffer();
    const base64 = correctedBuffer.toString("base64");
    return `data:image/jpeg;base64,${base64}`;
  } catch {
    return null;
  }
}

// ══════════════════════════════════════════════════════════
// Colores institucionales
// ══════════════════════════════════════════════════════════
const BRAND = {
  AZUL: [1, 84, 172] as [number, number, number],
  AZUL_CLARO: [188, 215, 234] as [number, number, number],
  FONDO_CLARO: [236, 241, 244] as [number, number, number],
  OSCURO: [26, 26, 51] as [number, number, number],
  VERDE: [0, 182, 2] as [number, number, number],
  BLANCO: [255, 255, 255] as [number, number, number],
  GRIS_BORDE: [176, 196, 222] as [number, number, number],
  GRIS_TEXTO: [100, 100, 100] as [number, number, number],
};

// ══════════════════════════════════════════════════════════
// GET /api/entregas-epp/exportar-pdf
// Query: mes (YYYY-MM), idEmpleado (optional), tipo (epp|dotacion)
// Returns: PDF binary
// ══════════════════════════════════════════════════════════
export async function GET(req: NextRequest) {
  try {
    const mes = req.nextUrl.searchParams.get("mes");
    const idEmpleadoFilter = req.nextUrl.searchParams.get("idEmpleado");
    const tipo = req.nextUrl.searchParams.get("tipo") || "dotacion";

    if (!mes || !/^\d{4}-\d{2}$/.test(mes)) {
      return NextResponse.json(
        { success: false, message: "Parámetro 'mes' requerido (formato YYYY-MM)" },
        { status: 400 }
      );
    }

    const sgHeaders = getSGSSTHeaders();
    const insHeaders = getInsumosHeaders();
    const authHeaders = getAirtableHeaders();

    const {
      entregasTableId, entregasFields,
      detalleTableId, detalleFields,
      tokensTableId, tokensFields,
    } = airtableSGSSTConfig;

    const { insumoTableId, insumoFields, categoriaTableId, categoriaFields } =
      airtableInsumosConfig;
    const { personalTableId, personalFields } = airtableConfig;

    // ── 1. Filtro por mes ───────────────────────────────
    const [year, month] = mes.split("-").map(Number);
    const entregasExtraParams: Record<string, string> = {
      [`sort[0][field]`]: entregasFields.FECHA_ENTREGA,
      [`sort[0][direction]`]: "asc",
    };

    let filterFormula = `AND(YEAR({${entregasFields.FECHA_ENTREGA}})=${year},MONTH({${entregasFields.FECHA_ENTREGA}})=${month})`;

    // Si filtran por empleado, agregar condición
    if (idEmpleadoFilter) {
      filterFormula = `AND(${filterFormula},{${entregasFields.ID_EMPLEADO_CORE}}='${idEmpleadoFilter.replace(/'/g, "\\'")}')`;
    }

    entregasExtraParams.filterByFormula = filterFormula;

    // ── 2. Fetch data en paralelo ───────────────────────
    const [allEntregas, allInsumos, allPersonal, allCategorias] =
      await Promise.all([
        fetchAllRecords(getSGSSTUrl(entregasTableId), sgHeaders, entregasExtraParams),
        fetchAllRecords(getInsumosUrl(insumoTableId), insHeaders),
        fetchAllRecords(getAirtableUrl(personalTableId), authHeaders),
        fetchAllRecords(getInsumosUrl(categoriaTableId), insHeaders),
      ]);

    if (allEntregas.length === 0) {
      return NextResponse.json(
        { success: false, message: `No hay entregas para ${getMesNombre(mes)}${idEmpleadoFilter ? " de este empleado" : ""}` },
        { status: 404 }
      );
    }

    // ── 3. Mapas de lookup ──────────────────────────────
    const categoryTipoMap = new Map<string, string>();
    for (const cat of allCategorias) {
      categoryTipoMap.set(cat.id, (cat.fields[categoriaFields.TIPO] as string) || "");
    }

    const insumoMap = new Map<string, { nombre: string; referencia: string; codigo: string; categoriaIds: string[] }>();
    for (const r of allInsumos) {
      const f = r.fields;
      const codigo = (f[insumoFields.CODIGO] as string) || "";
      insumoMap.set(codigo, {
        nombre: (f[insumoFields.NOMBRE] as string) || codigo,
        referencia: parseReferenciaComercial(f[insumoFields.REFERENCIA_COMERCIAL]),
        codigo,
        categoriaIds: (f[insumoFields.CATEGORIA] as string[]) || [],
      });
    }

    // Filtro por tipo (EPP/Dotación)
    const normalize = (s: string) =>
      s.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const tipoFilterCodes = new Set<string>();
    const targetNorm = normalize(tipo);
    for (const [codigo, info] of insumoMap) {
      const matchesTipo = info.categoriaIds.some((catId) => {
        const catTipo = categoryTipoMap.get(catId) || "";
        return normalize(catTipo) === targetNorm;
      });
      if (matchesTipo) tipoFilterCodes.add(codigo);
    }

    const personalMap = new Map<string, { nombre: string; documento: string; cargo: string }>();
    for (const r of allPersonal) {
      const f = r.fields;
      const idEmp = (f[personalFields.ID_EMPLEADO] as string) || "";
      const rawRol = f[personalFields.ROL_LOOKUP];
      const cargo = Array.isArray(rawRol) ? (rawRol[0] as string) || "" : (rawRol as string) || "";
      personalMap.set(idEmp, {
        nombre: (f[personalFields.NOMBRE_COMPLETO] as string) || idEmp,
        documento: (f[personalFields.NUMERO_DOCUMENTO] as string) || "",
        cargo,
      });
    }

    // ── 4. Collect linked IDs ───────────────────────────
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

    // ── 5. Agrupar entregas por empleado ────────────────
    interface EntregaInfo {
      idEntrega: string;
      fechaEntrega: string;
      motivo: string;
      estado: string;
      responsable: string;
      observaciones: string;
      fotoUrls: string[];
      signatureDataUrl: string;
      detalles: { nombre: string; referencia: string; cantidad: number; talla: string; condicion: string }[];
    }

    interface EmpleadoGroup {
      nombre: string;
      documento: string;
      cargo: string;
      entregas: EntregaInfo[];
    }

    const empleadoGroups = new Map<string, EmpleadoGroup>();

    for (const ent of allEntregas) {
      const f = ent.fields;
      const idEmp = (f[entregasFields.ID_EMPLEADO_CORE] as string) || "Desconocido";
      const empInfo = personalMap.get(idEmp) || { nombre: idEmp, documento: "", cargo: "" };

      if (!empleadoGroups.has(idEmp)) {
        empleadoGroups.set(idEmp, {
          nombre: empInfo.nombre,
          documento: empInfo.documento,
          cargo: empInfo.cargo,
          entregas: [],
        });
      }

      // Fotos de evidencia (attachment array)
      const rawFotos = f[entregasFields.FOTO_EVIDENCIA_URL];
      const fotoUrls: string[] = [];
      if (Array.isArray(rawFotos)) {
        for (const att of rawFotos) {
          if (att && typeof att === "object" && "url" in att) {
            fotoUrls.push((att as { url: string }).url);
          }
        }
      }

      // Firma descifrada
      let signatureDataUrl = "";
      const tLinks = (f[entregasFields.TOKENS_LINK] as string[]) || [];
      for (const tId of tLinks) {
        const tokRec = tokenMap.get(tId);
        if (!tokRec) continue;
        const tf = tokRec.fields;
        const hashFirma = (tf[tokensFields.HASH_FIRMA] as string) || "";
        const tokEstado = (tf[tokensFields.ESTADO] as string) || "";
        if (hashFirma && tokEstado === "Usado") {
          signatureDataUrl = tryDecryptSignature(hashFirma);
          break;
        }
      }

      // Detalles
      const dLinks = (f[entregasFields.DETALLE_LINK] as string[]) || [];
      const detalles: EntregaInfo["detalles"] = [];
      for (const dId of dLinks) {
        const detRec = detalleMap.get(dId);
        if (!detRec) continue;
        const df = detRec.fields;
        const codigoInsumo = (df[detalleFields.CODIGO_INSUMO] as string) || "";

        // Filtrar por tipo
        if (tipoFilterCodes.size > 0 && !tipoFilterCodes.has(codigoInsumo)) continue;

        const insumoInfo = insumoMap.get(codigoInsumo);
        detalles.push({
          nombre: insumoInfo?.nombre || codigoInsumo || "—",
          referencia: insumoInfo?.referencia || "—",
          cantidad: (df[detalleFields.CANTIDAD] as number) || 0,
          talla: (df[detalleFields.TALLA] as string) || "Única",
          condicion: (df[detalleFields.CONDICION] as string) || "Nuevo",
        });
      }

      // Solo agregar si tiene detalles del tipo solicitado
      if (detalles.length > 0) {
        empleadoGroups.get(idEmp)!.entregas.push({
          idEntrega: (f[entregasFields.ID_ENTREGA] as string) || "",
          fechaEntrega: (f[entregasFields.FECHA_ENTREGA] as string) || "",
          motivo: (f[entregasFields.MOTIVO] as string) || "",
          estado: (f[entregasFields.ESTADO] as string) || "",
          responsable: (f[entregasFields.RESPONSABLE] as string) || "",
          observaciones: (f[entregasFields.OBSERVACIONES] as string) || "",
          fotoUrls,
          signatureDataUrl,
          detalles,
        });
      }
    }

    // Eliminar empleados sin entregas después del filtrado
    for (const [key, group] of empleadoGroups) {
      if (group.entregas.length === 0) empleadoGroups.delete(key);
    }

    if (empleadoGroups.size === 0) {
      const tipoLabel = tipo === "dotacion" ? "Dotación" : "EPP";
      return NextResponse.json(
        { success: false, message: `No hay entregas de ${tipoLabel} para ${getMesNombre(mes)}` },
        { status: 404 }
      );
    }

    // ── 6. Pre-cargar imágenes ──────────────────────────
    // Recolectar todas las URLs únicas de fotos
    const allPhotoUrls = new Set<string>();
    for (const group of empleadoGroups.values()) {
      for (const ent of group.entregas) {
        ent.fotoUrls.forEach((u) => allPhotoUrls.add(u));
      }
    }

    // Descargar en paralelo (máx 10 a la vez)
    const photoCache = new Map<string, string>();
    const urlArray = Array.from(allPhotoUrls);
    const BATCH = 10;
    for (let i = 0; i < urlArray.length; i += BATCH) {
      const batch = urlArray.slice(i, i + BATCH);
      const results = await Promise.all(batch.map((u) => fetchImageAsBase64(u)));
      batch.forEach((u, idx) => {
        if (results[idx]) photoCache.set(u, results[idx]!);
      });
    }

    // ── 7. Logo de la empresa ───────────────────────────
    let logoBase64 = "";
    try {
      const logoPath = path.join(process.cwd(), "public", "logo.png");
      const logoBuf = fs.readFileSync(logoPath);
      logoBase64 = `data:image/png;base64,${logoBuf.toString("base64")}`;
    } catch { /* sin logo */ }

    // ── 8. Generar PDF con jsPDF ────────────────────────
    const tipoLabel = tipo === "dotacion" ? "Dotación" : "EPP";
    const mesLabel = getMesNombre(mes);
    const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
    const PAGE_W = doc.internal.pageSize.getWidth();
    const PAGE_H = doc.internal.pageSize.getHeight();
    const MARGIN = 15;
    const CONTENT_W = PAGE_W - MARGIN * 2;
    let isFirstPage = true;

    // Helpers PDF
    const addFooter = () => {
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(7);
        doc.setTextColor(...BRAND.GRIS_TEXTO);
        doc.text(
          `Sirius SG-SST · Entregas de ${tipoLabel} · ${mesLabel}`,
          MARGIN,
          PAGE_H - 8
        );
        doc.text(`Página ${i} de ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 8, {
          align: "right",
        });
        // Línea separadora footer
        doc.setDrawColor(...BRAND.GRIS_BORDE);
        doc.setLineWidth(0.3);
        doc.line(MARGIN, PAGE_H - 12, PAGE_W - MARGIN, PAGE_H - 12);
      }
    };

    const checkSpace = (needed: number, y: number): number => {
      if (y + needed > PAGE_H - 18) {
        doc.addPage();
        return MARGIN + 5;
      }
      return y;
    };

    // Iterar por cada empleado
    const sortedGroups = Array.from(empleadoGroups.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );

    for (const group of sortedGroups) {
      // Nueva página por empleado (excepto la primera)
      if (!isFirstPage) {
        doc.addPage();
      }
      isFirstPage = false;

      let y = MARGIN;

      // ── ENCABEZADO DEL DOCUMENTO ──────────────────────
      // Fondo del header
      doc.setFillColor(...BRAND.AZUL);
      doc.rect(0, 0, PAGE_W, 32, "F");

      // Logo
      if (logoBase64) {
        try {
          doc.addImage(logoBase64, "PNG", MARGIN, 4, 24, 24);
        } catch { /* sin logo */ }
      }

      // Título
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.setTextColor(...BRAND.BLANCO);
      doc.text(`ACTA DE ENTREGA DE ${tipoLabel.toUpperCase()}`, logoBase64 ? MARGIN + 28 : MARGIN, 14);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(`Período: ${mesLabel}`, logoBase64 ? MARGIN + 28 : MARGIN, 21);

      // Código del formato
      doc.setFontSize(8);
      doc.text(
        tipo === "dotacion" ? "CÓDIGO: FT-SST-023" : "CÓDIGO: FT-SST-029",
        PAGE_W - MARGIN,
        14,
        { align: "right" }
      );
      doc.text(`Fecha: ${new Date().toLocaleDateString("es-CO", { timeZone: "America/Bogota" })}`, PAGE_W - MARGIN, 21, {
        align: "right",
      });

      y = 40;

      // ── DATOS DEL EMPLEADO ────────────────────────────
      doc.setFillColor(...BRAND.FONDO_CLARO);
      doc.roundedRect(MARGIN, y, CONTENT_W, 26, 2, 2, "F");
      doc.setDrawColor(...BRAND.GRIS_BORDE);
      doc.roundedRect(MARGIN, y, CONTENT_W, 26, 2, 2, "S");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...BRAND.OSCURO);
      doc.text("DATOS DEL TRABAJADOR", MARGIN + 4, y + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...BRAND.GRIS_TEXTO);

      const col1 = MARGIN + 4;
      const col2 = MARGIN + CONTENT_W / 2;

      doc.text(`Nombre: `, col1, y + 13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND.OSCURO);
      doc.text(group.nombre, col1 + doc.getTextWidth("Nombre: "), y + 13);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRAND.GRIS_TEXTO);
      doc.text(`Documento: `, col2, y + 13);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND.OSCURO);
      doc.text(group.documento || "—", col2 + doc.getTextWidth("Documento: "), y + 13);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRAND.GRIS_TEXTO);
      doc.text(`Cargo: `, col1, y + 20);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND.OSCURO);
      doc.text(group.cargo || "—", col1 + doc.getTextWidth("Cargo: "), y + 20);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(...BRAND.GRIS_TEXTO);
      doc.text(`Total entregas: `, col2, y + 20);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...BRAND.OSCURO);
      doc.text(String(group.entregas.length), col2 + doc.getTextWidth("Total entregas: "), y + 20);

      y += 32;

      // ── CADA ENTREGA ──────────────────────────────────
      for (let entIdx = 0; entIdx < group.entregas.length; entIdx++) {
        const ent = group.entregas[entIdx];

        y = checkSpace(50, y);

        // Subtítulo de la entrega
        doc.setFillColor(...BRAND.AZUL_CLARO);
        doc.roundedRect(MARGIN, y, CONTENT_W, 8, 1.5, 1.5, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...BRAND.OSCURO);
        doc.text(
          `Entrega ${entIdx + 1}: ${ent.idEntrega || "S/N"}  —  ${formatFechaColombia(ent.fechaEntrega)}  —  ${ent.motivo || ""}`,
          MARGIN + 3,
          y + 5.5
        );

        // Badge de estado
        const estadoText = ent.estado || "—";
        const estadoW = doc.getTextWidth(estadoText) + 6;
        if (ent.estado === "Confirmada") doc.setFillColor(...BRAND.VERDE);
        else if (ent.estado === "Pendiente") doc.setFillColor(245, 158, 11);
        else doc.setFillColor(...BRAND.GRIS_TEXTO);
        doc.roundedRect(PAGE_W - MARGIN - estadoW - 2, y + 1, estadoW, 5.5, 1, 1, "F");
        doc.setFontSize(7);
        doc.setTextColor(...BRAND.BLANCO);
        doc.text(estadoText, PAGE_W - MARGIN - estadoW / 2 - 2, y + 5, { align: "center" });

        y += 12;

        // ── Tabla de detalles ───────────────────────────
        const tableBody = ent.detalles.map((d, i) => [
          String(i + 1),
          d.nombre,
          d.referencia,
          String(d.cantidad),
          d.talla,
          d.condicion,
        ]);

        autoTable(doc, {
          startY: y,
          margin: { left: MARGIN, right: MARGIN },
          head: [["#", `${tipoLabel} Entregado`, "Referencia", "Cant.", "Talla", "Condición"]],
          body: tableBody,
          theme: "grid",
          styles: {
            fontSize: 8,
            cellPadding: 2,
            lineColor: BRAND.GRIS_BORDE,
            lineWidth: 0.2,
          },
          headStyles: {
            fillColor: BRAND.AZUL,
            textColor: BRAND.BLANCO,
            fontStyle: "bold",
            fontSize: 8,
          },
          alternateRowStyles: {
            fillColor: BRAND.FONDO_CLARO,
          },
          columnStyles: {
            0: { cellWidth: 8, halign: "center" },
            1: { cellWidth: "auto" },
            2: { cellWidth: 40 },
            3: { cellWidth: 14, halign: "center" },
            4: { cellWidth: 18, halign: "center" },
            5: { cellWidth: 22, halign: "center" },
          },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        y = (doc as any).lastAutoTable.finalY + 4;

        // ── Observaciones ───────────────────────────────
        if (ent.observaciones) {
          y = checkSpace(14, y);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...BRAND.GRIS_TEXTO);
          doc.text("Observaciones:", MARGIN, y);
          doc.setFont("helvetica", "normal");
          const obsLines = doc.splitTextToSize(ent.observaciones, CONTENT_W - 30);
          doc.text(obsLines, MARGIN + 28, y);
          y += obsLines.length * 3.5 + 3;
        }

        // ── Responsable ─────────────────────────────────
        if (ent.responsable) {
          y = checkSpace(8, y);
          doc.setFontSize(7.5);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...BRAND.GRIS_TEXTO);
          doc.text("Responsable:", MARGIN, y);
          doc.setFont("helvetica", "normal");
          doc.text(ent.responsable, MARGIN + 26, y);
          y += 5;
        }

        // ── Fotos de evidencia ──────────────────────────
        if (ent.fotoUrls.length > 0) {
          y = checkSpace(15, y);

          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...BRAND.OSCURO);
          doc.text("Evidencias fotográficas:", MARGIN, y);
          y += 5;

          // Grid: máximo 3 fotos por fila, tamaño máx 55mm
          const PER_ROW = 3;
          const IMG_GAP = 4;
          const IMG_SIZE = Math.min(55, Math.floor((CONTENT_W - IMG_GAP * (PER_ROW - 1)) / PER_ROW));

          for (let rowStart = 0; rowStart < ent.fotoUrls.length; rowStart += PER_ROW) {
            const rowUrls = ent.fotoUrls.slice(rowStart, rowStart + PER_ROW);
            y = checkSpace(IMG_SIZE + 6, y);
            let imgX = MARGIN;

            for (const fotoUrl of rowUrls) {
              const imgData = photoCache.get(fotoUrl);
              if (imgData) {
                try {
                  doc.setDrawColor(...BRAND.GRIS_BORDE);
                  doc.setLineWidth(0.3);
                  doc.roundedRect(imgX - 0.5, y - 0.5, IMG_SIZE + 1, IMG_SIZE + 1, 1, 1, "S");
                  doc.addImage(imgData, "JPEG", imgX, y, IMG_SIZE, IMG_SIZE);
                } catch {
                  doc.setFillColor(...BRAND.FONDO_CLARO);
                  doc.rect(imgX, y, IMG_SIZE, IMG_SIZE, "F");
                  doc.setFontSize(7);
                  doc.setTextColor(...BRAND.GRIS_TEXTO);
                  doc.text("Imagen no\ndisponible", imgX + IMG_SIZE / 2, y + IMG_SIZE / 2, { align: "center" });
                }
              } else {
                doc.setFillColor(...BRAND.FONDO_CLARO);
                doc.roundedRect(imgX, y, IMG_SIZE, IMG_SIZE, 1, 1, "F");
                doc.setFontSize(7);
                doc.setTextColor(...BRAND.GRIS_TEXTO);
                doc.text("Imagen no\ndisponible", imgX + IMG_SIZE / 2, y + IMG_SIZE / 2, { align: "center" });
              }
              imgX += IMG_SIZE + IMG_GAP;
            }
            y += IMG_SIZE + 4;
          }

          y += 2;
        }

        // ── Firma del empleado ──────────────────────────
        if (ent.signatureDataUrl) {
          y = checkSpace(35, y);

          doc.setFontSize(8);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(...BRAND.OSCURO);
          doc.text("Firma del trabajador:", MARGIN, y);
          y += 3;

          try {
            const sigW = 50;
            const sigH = 20;
            doc.addImage(ent.signatureDataUrl, "PNG", MARGIN, y, sigW, sigH);
            // Línea bajo la firma
            doc.setDrawColor(...BRAND.OSCURO);
            doc.setLineWidth(0.3);
            doc.line(MARGIN, y + sigH + 1, MARGIN + sigW, y + sigH + 1);
            doc.setFontSize(7);
            doc.setTextColor(...BRAND.GRIS_TEXTO);
            doc.text(group.nombre, MARGIN, y + sigH + 5);
            doc.text(`CC: ${group.documento}`, MARGIN, y + sigH + 9);
            y += sigH + 14;
          } catch {
            doc.setFontSize(7);
            doc.setTextColor(...BRAND.GRIS_TEXTO);
            doc.text("(Firma no disponible)", MARGIN, y + 4);
            y += 10;
          }
        } else {
          // Espacio para firma manual
          y = checkSpace(25, y);
          doc.setDrawColor(...BRAND.OSCURO);
          doc.setLineWidth(0.3);
          doc.line(MARGIN, y + 15, MARGIN + 60, y + 15);
          doc.setFontSize(7);
          doc.setTextColor(...BRAND.GRIS_TEXTO);
          doc.text("Firma del trabajador", MARGIN, y + 19);
          doc.text(group.nombre, MARGIN, y + 23);
          y += 28;
        }

        // Separador entre entregas
        if (entIdx < group.entregas.length - 1) {
          y = checkSpace(8, y);
          doc.setDrawColor(...BRAND.AZUL_CLARO);
          doc.setLineWidth(0.5);
          doc.setLineDashPattern([2, 2], 0);
          doc.line(MARGIN + 10, y, PAGE_W - MARGIN - 10, y);
          doc.setLineDashPattern([], 0);
          y += 6;
        }
      }

      // ── Texto normativo al final (tipo dotación) ──────
      if (tipo === "dotacion") {
        y = checkSpace(40, y + 5);
        doc.setFillColor(255, 250, 240);
        doc.setDrawColor(...BRAND.GRIS_BORDE);
        doc.roundedRect(MARGIN, y, CONTENT_W, 35, 2, 2, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.5);
        doc.setTextColor(...BRAND.OSCURO);
        doc.text("DECLARACIÓN DEL TRABAJADOR", MARGIN + 4, y + 6);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(7);
        doc.setTextColor(...BRAND.GRIS_TEXTO);
        const declaracion = "Certifico que recibo a satisfacción los elementos de dotación personal nombrados anteriormente en buen estado, y haber sido informado de los trabajos y zonas en los que deberá utilizar dicha dotación, así como haber recibido instrucciones para su correcto uso y aceptando los siguientes compromisos: Usarla durante toda la jornada laboral, mantenerla en buen estado, reportar su deterioro oportunamente y devolverla al término de su relación laboral.";
        const decLines = doc.splitTextToSize(declaracion, CONTENT_W - 8);
        doc.text(decLines, MARGIN + 4, y + 12);
      }
    }

    // Agregar pies de página después de generar todo
    addFooter();

    // ── 9. Retornar PDF ─────────────────────────────────
    const pdfBuffer = Buffer.from(doc.output("arraybuffer"));

    const empleadoLabel = idEmpleadoFilter
      ? `_${(personalMap.get(idEmpleadoFilter)?.nombre || idEmpleadoFilter).replace(/\s+/g, "_").slice(0, 30)}`
      : "";
    const filename = `Entregas_${tipoLabel}${empleadoLabel}_${mes}.pdf`;

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
      { success: false, message: error instanceof Error ? error.message : "Error generando PDF" },
      { status: 500 }
    );
  }
}
