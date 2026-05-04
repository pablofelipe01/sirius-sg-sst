// ══════════════════════════════════════════════════════════
// Generador PDF — Actas COPASST y COCOLAB
// Fiel al formato oficial Sirius:
//   Encabezado 3 columnas · Título · Panel de datos ·
//   Secciones con texto parametrizado · Pie corporativo
// ══════════════════════════════════════════════════════════
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import fs from "fs";
import path from "path";
import { decryptFirmaActa } from "@/lib/firmaCrypto";
import {
  FORMATO_COMITE,
  type ActaCocolab,
  type ActaCompleta,
  type ActaCopasst,
  type ComiteTipo,
} from "./types";

// ── Paleta corporativa ───────────────────────────────────
const C = {
  VERDE:      [0, 182, 2]     as [number, number, number], // #00B602
  AZUL:       [1, 84, 172]    as [number, number, number], // #0154AC
  NEGRO:      [26, 26, 51]    as [number, number, number], // #1A1A33
  BLANCO:     [255, 255, 255] as [number, number, number],
  GRIS_CLARO: [242, 242, 242] as [number, number, number],
  GRIS_TEXTO: [100, 100, 115] as [number, number, number],
  ROJO:       [200, 50, 50]   as [number, number, number],
  VERDE_OK:   [30, 140, 60]   as [number, number, number],
  NARANJA:    [190, 110, 0]   as [number, number, number],
} as const;

// ── Datos fijos de la empresa ────────────────────────────
const EMPRESA    = "SIRIUS";
const NIT        = "901.377.064-8";
const TELEFONO   = "320 9568566";
const CORREO     = "adm@siriusregenerative.com";
const PLANTACION = "Barranca de Upía, km 7 vía Cabuyaro, Meta, Colombia";

// ── Diccionarios de etiquetas ────────────────────────────
const ROL_LABEL: Record<string, string> = {
  presidente:            "Presidente(a)",
  secretaria:            "Secretario(a)",
  secretario:            "Secretario(a)",
  suplente_empleador:    "Suplente Empleador",
  suplente_empresa:      "Suplente Empresa",
  suplente_trabajadores: "Suplente Trabajadores",
  invitado:              "Invitado(a)",
};

const RESULTADO_LABEL: Record<string, string> = {
  ok:                 "Conforme",
  oportunidad_mejora: "Oportunidad de mejora",
  critico:            "Crítico",
};

const CATEGORIA_LABEL: Record<string, string> = {
  riesgo_psicosocial:  "Riesgo Psicosocial",
  convivencia_laboral: "Convivencia Laboral",
  articulacion_sgsst:  "Articulación con SG-SST",
  cultura_preventiva:  "Cultura Preventiva",
  otro:                "Otro",
};

// ── Textos parametrizados por comité ────────────────────
const TITULO_ACTA: Record<ComiteTipo, string> = {
  COPASST: "ACTA MENSUAL COPASST",
  COCOLAB: "ACTA DE REUNIÓN – COMITÉ DE CONVIVENCIA LABORAL (COCOLAB)",
};

const FORMATO_HEADER_COL2: Record<ComiteTipo, string> = {
  COPASST: "FORMATO ACTA DE REUNIÓN COPASST",
  COCOLAB: "FORMATO ACTA DE REUNIÓN (COCOLAB)",
};

const NOMBRE_LARGO: Record<ComiteTipo, string> = {
  COPASST: "Comité Paritario de Seguridad y Salud en el Trabajo – COPASST",
  COCOLAB: "Comité de Convivencia Laboral – COCOLAB",
};

// ── Tipo auxiliar para jsPDF-AutoTable ───────────────────
type DocAT = jsPDF & { lastAutoTable: { finalY: number } };

interface BuildPdfOptions {
  acta: ActaCompleta;
  logoBase64?: string | null;
}

export async function generarPdfActaComite(
  options: BuildPdfOptions
): Promise<Buffer> {
  const { acta } = options;
  const comite: ComiteTipo = acta.comite;
  const fmt = FORMATO_COMITE[comite];

  // Cargar logo desde public/
  let logo64: string | null = options.logoBase64 ?? null;
  if (!logo64) {
    try {
      const p = path.join(process.cwd(), "public", "logo.png");
      if (fs.existsSync(p)) logo64 = fs.readFileSync(p).toString("base64");
    } catch { /* continuar sin logo */ }
  }

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const PW = doc.internal.pageSize.getWidth();   // 215.9 mm
  const PH = doc.internal.pageSize.getHeight();  // 279.4 mm
  const M  = 12;
  const CW = PW - M * 2;
  const FH = 24; // altura reservada pie de página (línea verde + 2 líneas texto + margen)

  let y = M;

  y = renderEncabezado(doc, y, M, CW, fmt, comite, logo64);
  y = renderTitulo(doc, y, M, CW, acta);
  y = renderPanelDatos(doc, y, M, CW, acta, comite);

  if (comite === "COPASST") {
    y = renderSeccionesCopasst(doc, acta as ActaCopasst, M, CW, PH, FH, y);
  } else {
    y = renderSeccionesCocolab(doc, acta as ActaCocolab, M, CW, PH, FH, y);
  }

  const totalPaginas = doc.getNumberOfPages();
  for (let p = 1; p <= totalPaginas; p++) {
    doc.setPage(p);
    renderPiePagina(doc, M, CW, PW, PH, p, totalPaginas);
  }

  return Buffer.from(doc.output("arraybuffer"));
}

// ══════════════════════════════════════════════════════════
// LAYOUT HELPERS
// ══════════════════════════════════════════════════════════

/** Altura de línea en mm */
function lh(fontSize: number): number {
  return (fontSize / 72) * 25.4 * 1.45;
}

/** Agrega nueva página si no hay espacio */
function checkPage(doc: jsPDF, y: number, needed: number, PH: number, FH: number): number {
  if (y + needed > PH - FH - 4) { doc.addPage(); return 16; }
  return y;
}

/** Barra de título de sección — fondo azul, texto blanco (incluye 5 mm de separación superior) */
function secTitle(doc: jsPDF, titulo: string, x: number, w: number, y: number): number {
  const top = 5;
  doc.setFillColor(...C.AZUL);
  doc.rect(x, y + top, w, 7.5, "F");
  doc.setTextColor(...C.BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(titulo, x + 3, y + top + 5.4);
  return y + top + 7.5 + 4;
}

/** Párrafo con texto envuelto */
function parrafo(
  doc: jsPDF,
  text: string,
  x: number,
  y: number,
  maxW: number,
  opts: { fs?: number; style?: string; color?: [number, number, number]; indent?: number } = {}
): number {
  const { fs: fontSize = 9, style = "normal", color = C.NEGRO, indent = 0 } = opts;
  doc.setFont("helvetica", style);
  doc.setFontSize(fontSize);
  doc.setTextColor(...color);
  const lines = doc.splitTextToSize(text, maxW - indent) as string[];
  doc.text(lines, x + indent, y);
  return y + lines.length * lh(fontSize) + 3;
}

/** Lista con viñetas o numerada */
function listaItems(
  doc: jsPDF,
  items: string[],
  x: number,
  y: number,
  maxW: number,
  opts: { numbered?: boolean; fs?: number } = {}
): number {
  const { numbered = false, fs: fontSize = 9 } = opts;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(fontSize);
  doc.setTextColor(...C.NEGRO);
  for (let i = 0; i < items.length; i++) {
    const prefix = numbered ? `${i + 1}.  ` : "•  ";
    const lines = doc.splitTextToSize(prefix + items[i], maxW - 8) as string[];
    doc.text(lines, x + 5, y);
    y += lines.length * lh(fontSize) + 0.8;
  }
  return y + 1;
}

/** Ítem con ✓ verde o ✗ rojo */
function checkItem(
  doc: jsPDF,
  texto: string,
  ok: boolean,
  x: number,
  y: number,
  maxW: number
): number {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(...(ok ? C.VERDE_OK : C.ROJO));
  doc.text(ok ? "✓" : "✗", x + 3, y);
  const lines = doc.splitTextToSize(texto, maxW - 12) as string[];
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...C.NEGRO);
  doc.text(lines, x + 10, y);
  return y + lines.length * lh(9) + 0.8;
}

/** Fallback logo sin imagen */
function drawLogoFallback(doc: jsPDF, x: number, y: number, w: number, h: number): void {
  doc.setFillColor(...C.VERDE);
  doc.roundedRect(x + 3, y + 3, w - 6, h - 6, 2, 2, "F");
  doc.setTextColor(...C.BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("SIRIUS", x + w / 2, y + h / 2 + 1.5, { align: "center" });
}

// ══════════════════════════════════════════════════════════
// SECCIONES ESTRUCTURALES
// ══════════════════════════════════════════════════════════

function renderEncabezado(
  doc: jsPDF, y: number, M: number, CW: number,
  fmt: (typeof FORMATO_COMITE)[ComiteTipo],
  comite: ComiteTipo,
  logo64: string | null
): number {
  const H  = 33;
  const cL = 40;  // col logo
  const cC = 54;  // col código
  const cM = CW - cL - cC;

  doc.setDrawColor(...C.NEGRO);
  doc.setLineWidth(0.4);
  doc.rect(M, y, CW, H);
  doc.line(M + cL,      y, M + cL,      y + H);
  doc.line(M + cL + cM, y, M + cL + cM, y + H);

  // Col 1: Logo
  if (logo64) {
    try {
      doc.addImage("data:image/png;base64," + logo64, "PNG", M + 4, y + 4, cL - 8, H - 8);
    } catch { drawLogoFallback(doc, M, y, cL, H); }
  } else {
    drawLogoFallback(doc, M, y, cL, H);
  }

  // Col 2: Empresa + nombre formato
  const cx = M + cL;
  doc.setTextColor(...C.NEGRO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("SIRIUS REGENERATIVE SOLUTIONS S.A.S. ZOMAC.", cx + cM / 2, y + 8, { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text(`NIT. ${NIT}`, cx + cM / 2, y + 13.5, { align: "center" });
  doc.setDrawColor(...C.GRIS_TEXTO);
  doc.setLineWidth(0.15);
  doc.line(cx + 5, y + 17, cx + cM - 5, y + 17);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(...C.AZUL);
  const fmtLines = doc.splitTextToSize(FORMATO_HEADER_COL2[comite], cM - 8) as string[];
  doc.text(fmtLines, cx + cM / 2, y + 20 + (fmtLines.length === 1 ? 4 : 2), { align: "center" });

  // Col 3: Código / versión / fecha
  const ccx = M + cL + cM;
  const rH  = H / 3;
  doc.setDrawColor(...C.NEGRO);
  doc.setLineWidth(0.3);
  doc.line(ccx, y + rH,     ccx + cC, y + rH);
  doc.line(ccx, y + 2 * rH, ccx + cC, y + 2 * rH);
  doc.setTextColor(...C.NEGRO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(`CODIGO: ${fmt.codigo}`,             ccx + cC / 2, y + rH / 2 + 1.5,           { align: "center" });
  doc.setFont("helvetica", "normal");
  doc.text(`VERSION: ${fmt.version}`,            ccx + cC / 2, y + rH + rH / 2 + 1.5,     { align: "center" });
  doc.text(`FECHA EDICION: ${fmt.fechaEdicion}`, ccx + cC / 2, y + 2 * rH + rH / 2 + 1.5, { align: "center" });

  return y + H + 3;
}

function renderTitulo(
  doc: jsPDF, y: number, M: number, CW: number, acta: ActaCompleta
): number {
  doc.setFillColor(...C.NEGRO);
  doc.rect(M, y, CW, 9.5, "F");
  doc.setTextColor(...C.BLANCO);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text(TITULO_ACTA[acta.comite], M + CW / 2, y + 6.6, { align: "center" });
  return y + 14;
}

function renderPanelDatos(
  doc: jsPDF, y: number, M: number, CW: number,
  acta: ActaCompleta, comite: ComiteTipo
): number {
  const cW = CW / 2;
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 28 },
    tableWidth: CW,
    theme: "plain",
    styles: {
      fontSize: 8.5,
      cellPadding: { top: 2, bottom: 2, left: 3, right: 3 },
      lineColor: C.NEGRO, lineWidth: 0.3,
      textColor: C.NEGRO, overflow: "linebreak",
    },
    columnStyles: {
      0: { fontStyle: "bold", cellWidth: cW * 0.30, fillColor: C.GRIS_CLARO },
      1: { fontStyle: "normal", cellWidth: cW * 0.70 },
      2: { fontStyle: "bold", cellWidth: cW * 0.30, fillColor: C.GRIS_CLARO },
      3: { fontStyle: "normal", cellWidth: cW * 0.70 },
    },
    body: [
      ["Empresa:",      EMPRESA,                   "Fecha de reunión:", formatFecha(acta.fechaReunion)],
      ["Comité:",       NOMBRE_LARGO[comite],       "Hora de inicio:",   formatHora(acta.horaInicio)],
      ["Acta No.:",     acta.numeroActa,            "Hora de cierre:",   formatHora(acta.horaCierre)],
      ["Mes evaluado:", acta.mesEvaluado,           "Lugar:",            acta.lugar],
    ],
  });
  return (doc as DocAT).lastAutoTable.finalY + 6;
}

function renderPiePagina(
  doc: jsPDF, M: number, CW: number, PW: number, PH: number,
  pagina: number, total: number
): void {
  const y0 = PH - 22; // línea verde separadora
  doc.setDrawColor(...C.VERDE);
  doc.setLineWidth(0.8);
  doc.line(M, y0, M + CW, y0);

  // Línea 1: texto corporativo
  const footerLine1 =
    `Sirius Regenerative Solutions SAS Zomar / Nit: ${NIT} / Teléfono: ${TELEFONO} / Correo: ${CORREO}`;
  // Línea 2: plantación + paginación
  const footerLine2 = `Plantación: ${PLANTACION}`;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.NEGRO);
  doc.text(footerLine1, M + CW / 2, y0 + 4.5, { align: "center" });
  doc.text(footerLine2, M + CW / 2, y0 + 9,   { align: "center" });

  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.setTextColor(...C.GRIS_TEXTO);
  doc.text(`Pág. ${pagina} / ${total}`, PW - M, y0 + 9, { align: "right" });
}

// ── Tabla de quórum ──────────────────────────────────────
function renderTablaQuorum(
  doc: jsPDF, acta: ActaCompleta, comite: ComiteTipo,
  M: number, CW: number, PH: number, FH: number, y: number
): number {
  const asistentes = acta.asistentes.filter((a) => a.asistio !== false);
  const hasFirmas  = asistentes.some((a) => a.firma && a.firma.length > 0);
  const rowH       = hasFirmas ? 24 : 8;

  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 28 },
    tableWidth: CW,
    theme: "grid",
    showHead: "firstPage",
    styles: {
      fontSize: 8.5, cellPadding: 2,
      textColor: C.NEGRO, lineColor: C.NEGRO, lineWidth: 0.3, overflow: "linebreak",
    },
    headStyles: { fillColor: C.AZUL, textColor: C.BLANCO, fontStyle: "bold", fontSize: 8.5, halign: "center" },
    bodyStyles: { minCellHeight: rowH },
    columnStyles: {
      0: { cellWidth: 42 },
      1: { cellWidth: 26, halign: "center" },
      2: { cellWidth: 40 },
      3: { cellWidth: 30 },
      4: { cellWidth: CW - 42 - 26 - 40 - 30, halign: "center" },
    },
    head: [["Nombre completo", "No. Identificación", "Cargo en la empresa", `Rol en el ${comite}`, "Firma"]],
    body: asistentes.map((a) => [
      a.nombre || "—",
      a.cedula || "—",
      a.cargo  || "—",
      a.rol ? (ROL_LABEL[a.rol.toLowerCase()] || a.rol) : "—",
      "",
    ]),
    didDrawCell: (data) => {
      if (data.section === "body" && data.column.index === 4 && hasFirmas) {
        const firma = asistentes[data.row.index]?.firma;
        if (firma && firma.startsWith("data:")) {
          try {
            const { x, y: cy, width, height } = data.cell;
            doc.addImage(firma, "PNG", x + 2, cy + 1, width - 4, height - 2);
          } catch { /* ignorar */ }
        }
      }
    },
  });
  return (doc as DocAT).lastAutoTable.finalY + 5;
}

// ── Tabla de compromisos ─────────────────────────────────
function renderTablaCompromisos(
  doc: jsPDF, acta: ActaCompleta, M: number, CW: number, y: number
): number {
  if (acta.compromisos.length === 0) {
    return parrafo(doc, "Sin compromisos registrados para este período.", M, y, CW, { style: "italic", color: C.GRIS_TEXTO });
  }
  autoTable(doc, {
    startY: y,
    margin: { left: M, right: M, bottom: 28 },
    tableWidth: CW,
    theme: "striped",
    styles: { fontSize: 8.5, cellPadding: 2.2, lineColor: C.NEGRO, lineWidth: 0.2, overflow: "linebreak" },
    headStyles: { fillColor: C.VERDE, textColor: C.BLANCO, fontStyle: "bold", halign: "center" },
    alternateRowStyles: { fillColor: C.GRIS_CLARO },
    columnStyles: {
      0: { cellWidth: CW * 0.55 },
      1: { cellWidth: CW * 0.25 },
      2: { cellWidth: CW * 0.20, halign: "center" },
    },
    head: [["Compromiso", "Responsable", "Fecha límite"]],
    body: acta.compromisos.map((c) => [c.compromiso, c.responsable, formatFechaCorta(c.fechaLimite)]),
  });
  return (doc as DocAT).lastAutoTable.finalY + 5;
}

// ── Firmas ────────────────────────────────────────────────
function renderFirmasSection(
  doc: jsPDF, acta: ActaCompleta,
  M: number, CW: number, PH: number, FH: number, y: number
): number {
  y = checkPage(doc, y, 68, PH, FH);
  type FR = { nombre: string; cedula: string; cargo: string; img: string | null };

  // Resuelve a partir del campo encriptado del cabecera (FirmaModal)
  const resolverEnc = (enc: string | null | undefined): FR => {
    if (enc) {
      try {
        const d = decryptFirmaActa(enc);
        return { nombre: d.nombre, cedula: d.cedula, cargo: d.cargo, img: d.signature };
      } catch { /* ignorar */ }
    }
    return { nombre: "", cedula: "", cargo: "", img: null };
  };

  // Resuelve a partir del asistente que firmó directamente (AsistenteFirmaModal)
  const resolverAsistente = (roles: string[]): FR => {
    const found = acta.asistentes.find((a) => {
      if (!a.firma) return false;
      const r = a.rol?.toLowerCase().trim() ?? "";
      return roles.some((role) => r === role || r.startsWith(role));
    });
    if (found) {
      return {
        nombre: found.nombre || "",
        cedula: found.cedula || "",
        cargo: found.cargo || "",
        img: found.firma && found.firma.startsWith("data:") ? found.firma : null,
      };
    }
    return { nombre: "", cedula: "", cargo: "", img: null };
  };

  // Prioridad: firma del cabecera (proceso formal) → firma del asistente (firma directa)
  const resPres = resolverEnc(acta.firmaPresidente);
  const presData: FR = resPres.nombre ? resPres : resolverAsistente(["presidente"]);
  const resSec  = resolverEnc(acta.firmaSecretario);
  const secData: FR = resSec.nombre ? resSec : resolverAsistente(["secretaria", "secretario"]);

  const secLabel = acta.comite === "COCOLAB" ? "Secretaria" : "Secretario(a)";
  const firmas = [
    { label: `Presidente ${acta.comite}`,  ...presData },
    { label: `${secLabel} ${acta.comite}`, ...secData },
  ];

  const bW = (CW - 12) / 2;
  const bH = 54;
  const pad = 3;
  const labelGap = 6; // espacio entre título y recuadro

  for (let i = 0; i < firmas.length; i++) {
    const f  = firmas[i];
    const bx = M + i * (bW + 12);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.AZUL);
    doc.text(f.label + ":", bx, y);
    doc.setDrawColor(...C.NEGRO);
    doc.setLineWidth(0.3);
    doc.rect(bx, y + labelGap, bW, bH);
    if (f.img && f.img.startsWith("data:")) {
      try { doc.addImage(f.img, "PNG", bx + pad, y + labelGap + pad, bW - pad * 2, bH - 22); } catch { /* ignorar */ }
    }
    doc.setDrawColor(...C.GRIS_TEXTO);
    doc.setLineWidth(0.4);
    doc.line(bx + 8, y + labelGap + bH - 17, bx + bW - 8, y + labelGap + bH - 17);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(...C.NEGRO);
    if (f.nombre) {
      doc.text(f.nombre, bx + bW / 2, y + labelGap + bH - 12, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      if (f.cedula) doc.text(`C.C. ${f.cedula}`, bx + bW / 2, y + labelGap + bH - 7,   { align: "center" });
      if (f.cargo)  doc.text(f.cargo,             bx + bW / 2, y + labelGap + bH - 2.5, { align: "center" });
    } else {
      // Sin firma aún — placeholder discreto
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...C.GRIS_TEXTO);
      doc.text("Pendiente de firma", bx + bW / 2, y + labelGap + bH - 10, { align: "center" });
    }
  }
  return y + labelGap + bH + 8;
}

// ══════════════════════════════════════════════════════════
// SECCIONES COPASST
// ══════════════════════════════════════════════════════════
function renderSeccionesCopasst(
  doc: jsPDF, acta: ActaCopasst,
  M: number, CW: number, PH: number, FH: number, y: number
): number {
  const mes = acta.mesEvaluado;

  // 1. Apertura con propósito
  y = checkPage(doc, y, 50, PH, FH);
  y = secTitle(doc, "1. Apertura con propósito", M, CW, y);
  y = parrafo(doc,
    `Se inicia la sesión mensual del COPASST correspondiente al mes de ${mes}, reiterando el ` +
    `compromiso institucional de ${EMPRESA} con la prevención de riesgos laborales, la promoción ` +
    `del autocuidado y el fortalecimiento de la cultura de seguridad en la planta de pirolisis, ` +
    `laboratorio y áreas administrativas, en cumplimiento del Decreto 1072 de 2015 y la Resolución ` +
    `0312 de 2019. Se resalta la importancia de mantener la mejora continua en los procesos de ` +
    `identificación de peligros, evaluación y control de riesgos, promoviendo la participación de ` +
    `todos los colaboradores.`,
    M, y, CW);

  // 2. Verificación de quórum
  y = checkPage(doc, y, 45, PH, FH);
  y = secTitle(doc, "2. Verificación de quórum", M, CW, y);
  y = parrafo(doc,
    "Verificada la asistencia de los integrantes del comité, se constata la existencia de quórum " +
    "deliberativo y decisorio, dando validez al desarrollo de la reunión.",
    M, y, CW);
  y += 2;
  y = renderTablaQuorum(doc, acta, "COPASST", M, CW, PH, FH, y);

  // 3. Orden del día
  y = checkPage(doc, y, 50, PH, FH);
  y = secTitle(doc, "3. Orden del día", M, CW, y);
  y = listaItems(doc, [
    "Apertura con enfoque preventivo y cultura de autocuidado.",
    "Verificación del quórum.",
    "Análisis de accidentes e incidentes de trabajo.",
    "Revisión de actos y condiciones inseguras.",
    "Capacitación e inspecciones de seguridad.",
    "Novedades administrativas del COPASST.",
    "Compromisos y cierre.",
  ], M, y, CW, { numbered: true });
  y = parrafo(doc, "El orden del día es aprobado por unanimidad.", M, y, CW, { style: "italic" });

  // 4. Análisis de accidentes e incidentes
  y = checkPage(doc, y, 45, PH, FH);
  y = secTitle(doc, "4. Análisis de accidentes e incidentes de trabajo", M, CW, y);
  y = parrafo(doc, `Durante el mes de ${mes}, se da constancia de que:`, M, y, CW);
  y = checkItem(doc,
    acta.accidentesPresentados
      ? `Se presentaron accidentes de trabajo.${acta.accidentesDetalle ? " " + acta.accidentesDetalle : ""}`
      : "No se presentaron accidentes de trabajo.",
    !acta.accidentesPresentados, M, y, CW);
  y = checkItem(doc,
    acta.incidentesPresentados
      ? `Se presentaron incidentes laborales.${acta.incidentesDetalle ? " " + acta.incidentesDetalle : ""}`
      : "No se presentaron incidentes laborales.",
    !acta.incidentesPresentados, M, y, CW);
  if (!acta.accidentesPresentados && !acta.incidentesPresentados) {
    y += 1;
    y = parrafo(doc,
      "Este resultado refleja un entorno laboral responsable que promueve el reporte de " +
      "condiciones subastándar como herramienta preventiva y no correctiva.",
      M, y, CW, { style: "italic", color: C.GRIS_TEXTO });
  }

  // 5. Condiciones inseguras
  y = checkPage(doc, y, 40, PH, FH);
  y = secTitle(doc, "5. Revisión de actos y condiciones inseguras", M, CW, y);
  y = parrafo(doc,
    "Se realizó evaluación de condiciones a los colaboradores, promoviendo el reporte de " +
    "condiciones subastándar como herramienta preventiva y no correctiva.",
    M, y, CW);
  y += 1;
  if (acta.condicionesInseguras.length === 0) {
    y = parrafo(doc, "No se identificaron condiciones inseguras en el período.",
      M, y, CW, { style: "italic", color: C.GRIS_TEXTO });
  } else {
    const hasCritico = acta.condicionesInseguras.some((c) => c.resultado === "critico");
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 28 },
      tableWidth: CW,
      theme: "striped",
      styles: { fontSize: 8.5, cellPadding: 2, lineColor: C.NEGRO, lineWidth: 0.2, overflow: "linebreak" },
      headStyles: { fillColor: C.AZUL, textColor: C.BLANCO, fontStyle: "bold" },
      alternateRowStyles: { fillColor: C.GRIS_CLARO },
      columnStyles: {
        0: { cellWidth: CW * 0.50 },
        1: { cellWidth: CW * 0.22, halign: "center" },
        2: { cellWidth: CW * 0.28 },
      },
      head: [["Descripción de la condición", "Resultado", "Observación"]],
      body: acta.condicionesInseguras.map((c) => [
        c.descripcion,
        RESULTADO_LABEL[c.resultado] || c.resultado,
        c.observacion || "—",
      ]),
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 1) {
          const r = acta.condicionesInseguras[data.row.index]?.resultado;
          data.cell.styles.fontStyle = "bold";
          if (r === "critico")              data.cell.styles.textColor = C.ROJO;
          else if (r === "oportunidad_mejora") data.cell.styles.textColor = C.NARANJA;
          else                               data.cell.styles.textColor = C.VERDE_OK;
        }
      },
    });
    y = (doc as DocAT).lastAutoTable.finalY + 2;
    y = parrafo(doc,
      hasCritico
        ? "Resultado: Se identificaron condiciones críticas que requieren atención inmediata."
        : "Resultado: No se identificaron condiciones críticas. Las oportunidades de mejora detectadas fueron gestionadas de manera preventiva.",
      M, y, CW, { style: "italic", color: hasCritico ? C.ROJO : C.VERDE_OK });
  }

  // 6. Capacitaciones
  y = checkPage(doc, y, 40, PH, FH);
  y = secTitle(doc, "6. Capacitación e inspecciones de seguridad", M, CW, y);
  if (acta.capacitaciones.length === 0) {
    y = parrafo(doc,
      `Se realizó evaluación de conocimientos a los colaboradores, evidenciando apropiación ` +
      `general de los conceptos. Sin capacitaciones formales registradas en el período de ${mes}.`,
      M, y, CW);
  } else {
    y = parrafo(doc,
      `Se realizó capacitación al equipo de COPASST: Rol estratégico del COPASST en la ` +
      `prevención de accidentes y enfermedades laborales, durante el mes de ${mes}.`,
      M, y, CW);
    y += 1;
    autoTable(doc, {
      startY: y,
      margin: { left: M, right: M, bottom: 28 },
      tableWidth: CW,
      theme: "striped",
      styles: { fontSize: 8.5, cellPadding: 2, lineColor: C.NEGRO, lineWidth: 0.2, overflow: "linebreak" },
      headStyles: { fillColor: C.AZUL, textColor: C.BLANCO, fontStyle: "bold" },
      alternateRowStyles: { fillColor: C.GRIS_CLARO },
      columnStyles: { 0: { cellWidth: CW * 0.72 }, 1: { cellWidth: CW * 0.28, halign: "center" } },
      head: [["Tema de capacitación", "Fecha de ejecución"]],
      body: acta.capacitaciones.map((c) => [c.tema || "—", c.fechaEjecucion || "—"]),
    });
    y = (doc as DocAT).lastAutoTable.finalY + 2;
    y = parrafo(doc,
      "La actualización se realiza conforme a la normativa vigente y queda aprobada por el comité.",
      M, y, CW, { style: "italic", color: C.GRIS_TEXTO });
  }

  // 7. Novedades administrativas
  y = checkPage(doc, y, 25, PH, FH);
  y = secTitle(doc, "7. Novedades administrativas del COPASST", M, CW, y);
  y = parrafo(doc,
    acta.novedadesAdministrativas?.trim() || "Sin novedades administrativas para el presente período.",
    M, y, CW,
    { style: acta.novedadesAdministrativas?.trim() ? "normal" : "italic",
      color:  acta.novedadesAdministrativas?.trim() ? C.NEGRO : C.GRIS_TEXTO });

  // 8. Compromisos
  y = checkPage(doc, y, 35, PH, FH);
  y = secTitle(doc, "8. Compromisos", M, CW, y);
  y = renderTablaCompromisos(doc, acta, M, CW, y);

  // 9. Cierre
  y = checkPage(doc, y, 30, PH, FH);
  y = secTitle(doc, "9. Cierre", M, CW, y);
  y = parrafo(doc,
    `No siendo otro el objeto de la reunión, se da por finalizada la sesión del COPASST ` +
    `correspondiente a ${mes}, dejando constancia de que este comité continúa siendo un espacio ` +
    `estratégico para proteger la vida, fortalecer la operación segura y consolidar la cultura ` +
    `preventiva en ${EMPRESA}.`,
    M, y, CW);

  // Firmas
  y = checkPage(doc, y, 70, PH, FH);
  y = secTitle(doc, "Firmas", M, CW, y);
  return renderFirmasSection(doc, acta, M, CW, PH, FH, y);
}

// ══════════════════════════════════════════════════════════
// SECCIONES COCOLAB
// ══════════════════════════════════════════════════════════
function renderSeccionesCocolab(
  doc: jsPDF, acta: ActaCocolab,
  M: number, CW: number, PH: number, FH: number, y: number
): number {
  const mes = acta.mesEvaluado;

  // 1. Apertura con sentido
  y = checkPage(doc, y, 60, PH, FH);
  y = secTitle(doc, "1. Apertura con sentido", M, CW, y);
  y = parrafo(doc,
    `Se inicia la sesión ordinaria del Comité de Convivencia Laboral correspondiente al mes de ` +
    `${mes}, reiterando el compromiso institucional de ${EMPRESA} con la promoción de relaciones ` +
    `laborales basadas en el respeto, la comunicación asertiva y la prevención temprana de ` +
    `situaciones que puedan afectar la dignidad humana, en cumplimiento de la normativa vigente. ` +
    `Durante este período, se resalta el fortalecimiento de la convivencia laboral a través de ` +
    `estrategias integrales que articulan el bienestar emocional, la gestión del riesgo psicosocial ` +
    `y la construcción de entornos laborales saludables y sostenibles, en cumplimiento de la ` +
    `Resolución 652 de 2012, Resolución 1356 de 2012 y Resolución 446 de 2020. Se recuerda que el ` +
    `COCOLAB es un espacio preventivo, confidencial y conciliador, orientado al fortalecimiento del ` +
    `clima organizacional.`,
    M, y, CW);

  // 2. Verificación de quórum
  y = checkPage(doc, y, 45, PH, FH);
  y = secTitle(doc, "2. Verificación de quórum", M, CW, y);
  y = parrafo(doc,
    "Verificada la asistencia de los integrantes del comité, se constata la existencia de quórum " +
    "deliberativo y decisorio, permitiendo el desarrollo formal de la reunión.",
    M, y, CW);
  y += 2;
  y = renderTablaQuorum(doc, acta, "COCOLAB", M, CW, PH, FH, y);

  // 3. Orden del día
  y = checkPage(doc, y, 45, PH, FH);
  y = secTitle(doc, "3. Orden del día", M, CW, y);
  y = listaItems(doc, [
    "Apertura y encuadre del espacio COCOLAB.",
    "Verificación del quórum.",
    "Revisión de situaciones de convivencia laboral del mes.",
    "Acciones de prevención y fortalecimiento del clima laboral.",
    "Compromisos.",
    "Cierre reflexivo.",
  ], M, y, CW);
  y = parrafo(doc, "El orden del día es aprobado por unanimidad.", M, y, CW, { style: "italic" });

  // 4. Revisión situaciones de convivencia laboral
  y = checkPage(doc, y, 45, PH, FH);
  y = secTitle(doc, "4. Revisión de situaciones de convivencia laboral", M, CW, y);
  y = parrafo(doc, `Durante el mes de ${mes}, el comité deja constancia de que:`, M, y, CW);
  y = checkItem(doc,
    acta.quejasAcoso
      ? `Se recibieron quejas formales por presunto acoso laboral.${acta.quejasAcosoDetalle ? " " + acta.quejasAcosoDetalle : ""}`
      : "No se recibieron quejas formales por presunto acoso laboral.",
    !acta.quejasAcoso, M, y, CW);
  y = checkItem(doc,
    acta.conflictosLaborales
      ? `Se reportaron conflictos laborales que requirieron intervención del COCOLAB.${acta.conflictosLaboralesDetalle ? " " + acta.conflictosLaboralesDetalle : ""}`
      : "No se reportaron conflictos laborales que requirieran intervención del COCOLAB.",
    !acta.conflictosLaborales, M, y, CW);
  y += 1;
  y = parrafo(doc,
    "Este resultado refleja un ambiente laboral basado en el respeto, la comunicación asertiva " +
    "y la corresponsabilidad en las interacciones.",
    M, y, CW, { style: "italic", color: C.GRIS_TEXTO });

  // 5. Acciones preventivas
  y = checkPage(doc, y, 35, PH, FH);
  y = secTitle(doc, "5. Acciones de prevención y fortalecimiento del clima laboral", M, CW, y);
  y = parrafo(doc, "El comité destaca como acciones preventivas:", M, y, CW);
  y += 1;
  if (acta.accionesPreventivas.length === 0) {
    y = parrafo(doc, "Sin acciones preventivas registradas para este período.",
      M, y, CW, { style: "italic", color: C.GRIS_TEXTO });
  } else {
    for (const accion of acta.accionesPreventivas) {
      const cat = CATEGORIA_LABEL[accion.categoria] || accion.categoria;
      y = parrafo(doc, `•  ${cat}: ${accion.descripcion}`, M, y, CW, { indent: 5 });
    }
    y += 1;
  }

  // 6. Compromisos
  y = checkPage(doc, y, 35, PH, FH);
  y = secTitle(doc, "6. Compromisos", M, CW, y);
  y = renderTablaCompromisos(doc, acta, M, CW, y);

  // 7. Cierre consciente
  y = checkPage(doc, y, 40, PH, FH);
  y = secTitle(doc, "7. Cierre consciente", M, CW, y);
  y = parrafo(doc,
    `No siendo otro el objeto de la reunión, se da por finalizada la sesión del COCOLAB ` +
    `correspondiente al mes de ${mes}, reiterando el compromiso al equipo de COCOLAB: que la ` +
    `convivencia laboral es una responsabilidad compartida y un pilar fundamental para la ` +
    `sostenibilidad organizacional.`,
    M, y, CW);
  y += 2;
  y = parrafo(doc,
    `El comité reafirma su disposición como espacio seguro, imparcial y preventivo al servicio ` +
    `de todos los colaboradores de ${EMPRESA}.`,
    M, y, CW, { style: "italic" });

  // Firmas
  y = checkPage(doc, y, 70, PH, FH);
  y = secTitle(doc, "Firmas", M, CW, y);
  return renderFirmasSection(doc, acta, M, CW, PH, FH, y);
}

// ══════════════════════════════════════════════════════════
// UTILIDADES DE FORMATO
// ══════════════════════════════════════════════════════════

function formatFecha(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("es-CO", {
      timeZone: "America/Bogota", year: "numeric", month: "long", day: "2-digit",
    });
  } catch { return iso; }
}

function formatFechaCorta(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("es-CO", {
      timeZone: "America/Bogota", year: "numeric", month: "short", day: "2-digit",
    });
  } catch { return iso; }
}

function formatHora(hhmm: string): string {
  if (!hhmm) return "—";
  const [h, m] = hhmm.split(":").map(Number);
  const ampm = h >= 12 ? "p.m." : "a.m.";
  const h12  = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${h12}:${String(m || 0).padStart(2, "0")} ${ampm}`;
}
