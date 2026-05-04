"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Loader2,
  Download,
  PenTool,
  Eraser,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FileText,
  UserCheck,
} from "lucide-react";
import AsistenteFirmaModal from "@/presentation/components/comites/AsistenteFirmaModal";

type ComiteSlug = "copasst" | "cocolab";

interface Acta {
  idActa: string;
  numeroActa: string;
  mesEvaluado: string;
  fechaReunion: string;
  horaInicio: string;
  horaCierre: string;
  lugar: string;
  estado: "borrador" | "firmada";
  urlDocumento?: string | null;
  comite: "COPASST" | "COCOLAB";
  asistentes: Array<{
    recordId: string;
    nombre?: string;
    cedula?: string;
    cargo?: string;
    rol?: string;
    asistio?: boolean;
    firma?: string | null;
    fechaFirma?: string | null;
  }>;
  compromisos: Array<{
    compromiso: string;
    responsable: string;
    fechaLimite: string;
    cumplido?: boolean | null;
  }>;
  // COPASST
  accidentesPresentados?: boolean;
  accidentesDetalle?: string | null;
  incidentesPresentados?: boolean;
  incidentesDetalle?: string | null;
  novedadesAdministrativas?: string | null;
  condicionesInseguras?: Array<{
    descripcion: string;
    resultado: string;
    observacion?: string | null;
  }>;
  capacitaciones?: Array<{
    recordId: string;
    tema: string;
    fechaEjecucion?: string | null;
  }>;
  // COCOLAB
  quejasAcoso?: boolean;
  quejasAcosoDetalle?: string | null;
  conflictosLaborales?: boolean;
  conflictosLaboralesDetalle?: string | null;
  accionesPreventivas?: Array<{ categoria: string; descripcion: string }>;
}

const ROL_LABEL: Record<string, string> = {
  presidente: "Presidente(a)",
  secretaria: "Secretario(a)",
  suplente_empleador: "Suplente Empleador",
  suplente_empresa: "Suplente Empresa",
  suplente_trabajadores: "Suplente Trabajadores",
  invitado: "Invitado(a)",
};

export default function DetalleActaPage({
  params,
}: {
  params: Promise<{ comite: ComiteSlug; id: string }>;
}) {
  const { comite, id } = use(params);
  const router = useRouter();
  const [acta, setActa] = useState<Acta | null>(null);
  const [loading, setLoading] = useState(true);
  const [modalAsistente, setModalAsistente] = useState<{
    recordId: string;
    nombre: string;
    cedula: string;
    cargo: string;
  } | null>(null);

  const cargar = async () => {
    setLoading(true);
    try {
      const r = await fetch(`/api/${comite}/actas/${id}`, { cache: "no-store" });
      const j = await r.json();
      setActa(j.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comite, id]);

  const accent = comite === "cocolab"
    ? { iconBg: "bg-emerald-500/20 border-emerald-400/30", iconText: "text-emerald-300" }
    : { iconBg: "bg-blue-500/20 border-blue-400/30", iconText: "text-blue-300" };

  const Shell = ({ children }: { children: React.ReactNode }) => (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10">
        <Image
          src="/20032025-DSC_3717.jpg"
          alt=""
          fill
          className="object-cover"
          priority
          quality={85}
        />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      </div>
      <header className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 py-5">
            <button
              onClick={() => router.push(`/dashboard/comites/${comite}`)}
              className="flex items-center gap-2 rounded-full bg-white/10 border border-white/20 px-4 py-2 text-sm font-semibold text-white/80 hover:bg-white/20 hover:border-white/30 transition-all cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              Volver
            </button>
            <div className="h-8 w-px bg-white/20" />
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-lg border flex items-center justify-center ${accent.iconBg}`}>
                <FileText className={`w-5 h-5 ${accent.iconText}`} />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">
                  {acta ? `Acta N° ${acta.numeroActa}` : `Acta ${comite.toUpperCase()}`}
                </h1>
                <p className="text-xs text-white/50">SG-SST</p>
              </div>
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">{children}</main>
    </div>
  );

  if (loading) {
    return (
      <Shell>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-white/70" />
        </div>
      </Shell>
    );
  }

  if (!acta) {
    return (
      <Shell>
        <div className="text-center text-white/80 py-12">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 text-amber-300" />
          <p>Acta no encontrada</p>
          <Link
            href={`/dashboard/comites/${comite}`}
            className="text-blue-300 hover:text-blue-200 mt-4 inline-block"
          >
            ← Volver al listado
          </Link>
        </div>
      </Shell>
    );
  }

  const presidente = acta.asistentes.find((i) => i.rol?.toLowerCase() === "presidente");
  const secretario = acta.asistentes.find(
    (i) => i.rol?.toLowerCase() === "secretaria" || i.rol?.toLowerCase() === "secretario"
  );

  return (
    <Shell>
      {/* Header acta */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-white">
            Acta N° {acta.numeroActa}
          </h2>
          <p className="text-white/60 text-sm mt-1">
            {acta.mesEvaluado} — {formatFecha(acta.fechaReunion)}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {acta.estado === "firmada" ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs px-3 py-1">
              <CheckCircle2 className="w-4 h-4" /> Firmada
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/20 border border-amber-400/30 text-amber-300 text-xs px-3 py-1">
              Borrador
            </span>
          )}
          <a
            href={`/api/${comite}/actas/${id}/pdf`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white text-sm px-3 py-1.5 transition-colors"
          >
            <Download className="w-4 h-4" /> Previsualizar PDF
          </a>
        </div>
      </div>

      {/* Datos generales */}
      <Card titulo="Datos generales">
        <DL items={[
          ["Lugar", acta.lugar],
          ["Hora inicio", acta.horaInicio],
          ["Hora cierre", acta.horaCierre],
          ["Mes evaluado", acta.mesEvaluado],
        ]} />
      </Card>

      {/* Asistentes */}
      <Card titulo={`Asistentes (${acta.asistentes.length})`}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-white/60 text-left">
              <tr>
                <th className="py-1">Nombre</th>
                <th className="py-1">Cédula</th>
                <th className="py-1">Cargo</th>
                <th className="py-1">Rol</th>
                <th className="py-1 text-center">Asistió</th>
                <th className="py-1 text-center">Firma</th>
              </tr>
            </thead>
            <tbody>
              {acta.asistentes.map((i, idx) => (
                <tr key={idx} className="border-t border-white/10">
                  <td className="py-1.5 text-white/90">{i.nombre || "—"}</td>
                  <td className="py-1.5 text-white/70">{i.cedula || "—"}</td>
                  <td className="py-1.5 text-white/70">{i.cargo || "—"}</td>
                  <td className="py-1.5 text-white/70">{i.rol ? (ROL_LABEL[i.rol.toLowerCase()] || i.rol) : "—"}</td>
                  <td className="py-1.5 text-white/70 text-center">{i.asistio === false ? "No" : "Sí"}</td>
                  <td className="py-1.5 text-center">
                    {i.asistio !== false && (
                      i.firma ? (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Firmado
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setModalAsistente({
                            recordId: i.recordId,
                            nombre: i.nombre || "",
                            cedula: i.cedula || "",
                            cargo: i.cargo || "",
                          })}
                          className="text-xs px-2 py-1 rounded bg-blue-600/20 hover:bg-blue-600/30 border border-blue-400/30 text-blue-300 transition-colors inline-flex items-center gap-1"
                        >
                          <UserCheck className="w-3 h-3" /> Firmar
                        </button>
                      )
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Específicos */}
      {acta.comite === "COPASST" && (
        <>
          <Card titulo="Accidentes e incidentes">
            <DL items={[
              ["Accidentes", acta.accidentesPresentados ? "Sí" : "No"],
              ["Detalle accidentes", acta.accidentesDetalle || "—"],
              ["Incidentes", acta.incidentesPresentados ? "Sí" : "No"],
              ["Detalle incidentes", acta.incidentesDetalle || "—"],
            ]} />
          </Card>
          {acta.condicionesInseguras && acta.condicionesInseguras.length > 0 && (
            <Card titulo="Condiciones inseguras">
              <ul className="space-y-2 text-sm">
                {acta.condicionesInseguras.map((c, i) => (
                  <li key={i} className="text-white/80">
                    • <strong className="text-white">{c.descripcion}</strong> — {c.resultado}
                    {c.observacion && <span className="text-white/50"> ({c.observacion})</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {acta.capacitaciones && acta.capacitaciones.length > 0 && (
            <Card titulo="Capacitaciones">
              <ul className="space-y-2 text-sm">
                {acta.capacitaciones.map((c, i) => (
                  <li key={i} className="text-white/80">
                    • <strong className="text-white">{c.tema || "(sin tema)"}</strong>
                    {c.fechaEjecucion && <span className="text-white/50"> — {formatFecha(c.fechaEjecucion)}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {acta.novedadesAdministrativas && (
            <Card titulo="Novedades administrativas">
              <p className="text-white/80 text-sm whitespace-pre-wrap">
                {acta.novedadesAdministrativas}
              </p>
            </Card>
          )}
        </>
      )}

      {acta.comite === "COCOLAB" && (
        <>
          <Card titulo="Quejas y conflictos">
            <DL items={[
              ["Quejas de acoso", acta.quejasAcoso ? "Sí" : "No"],
              ["Detalle", acta.quejasAcosoDetalle || "—"],
              ["Conflictos laborales", acta.conflictosLaborales ? "Sí" : "No"],
              ["Detalle", acta.conflictosLaboralesDetalle || "—"],
            ]} />
          </Card>
          {acta.accionesPreventivas && acta.accionesPreventivas.length > 0 && (
            <Card titulo="Acciones preventivas">
              <ul className="space-y-2 text-sm">
                {acta.accionesPreventivas.map((a, i) => (
                  <li key={i} className="text-white/80">
                    • <strong className="text-white">{a.categoria.replace(/_/g, " ")}:</strong> {a.descripcion}
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </>
      )}

      {acta.compromisos.length > 0 && (
        <Card titulo={`Compromisos (${acta.compromisos.length})`}>
          <table className="w-full text-sm">
            <thead className="text-white/60 text-left">
              <tr>
                <th className="py-1">Compromiso</th>
                <th className="py-1">Responsable</th>
                <th className="py-1">Fecha límite</th>
                <th className="py-1">Cumplido</th>
              </tr>
            </thead>
            <tbody>
              {acta.compromisos.map((c, i) => (
                <tr key={i} className="border-t border-white/10">
                  <td className="py-1.5 text-white/90">{c.compromiso}</td>
                  <td className="py-1.5 text-white/70">{c.responsable}</td>
                  <td className="py-1.5 text-white/70">{formatFecha(c.fechaLimite)}</td>
                  <td className="py-1.5 text-white/70">
                    {c.cumplido === true ? "Sí" : c.cumplido === false ? "No" : "Pendiente"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {modalAsistente && (
        <AsistenteFirmaModal
          isOpen={true}
          onClose={() => setModalAsistente(null)}
          miembroNombre={modalAsistente.nombre}
          miembroCedula={modalAsistente.cedula}
          miembroCargo={modalAsistente.cargo}
          miembroRecordId={modalAsistente.recordId}
          onFirmaGuardada={() => {
            setModalAsistente(null);
            cargar(); // Recargar acta para mostrar firma actualizada
          }}
          comite={comite}
          actaId={id}
        />
      )}
    </Shell>
  );
}

function formatFecha(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso + "T00:00:00").toLocaleDateString("es-CO", {
      timeZone: "America/Bogota",
      year: "numeric",
      month: "long",
      day: "2-digit",
    });
  } catch {
    return iso;
  }
}

function Card({
  titulo,
  children,
}: {
  titulo: string;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-5 mb-4">
      <h2 className="text-base font-semibold text-white mb-3">{titulo}</h2>
      {children}
    </section>
  );
}

function DL({ items }: { items: Array<[string, string | undefined | null]> }) {
  return (
    <dl className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 text-sm">
      {items.map(([k, v], idx) => (
        <div key={idx} className="flex flex-col">
          <dt className="text-white/50 text-xs">{k}</dt>
          <dd className="text-white/90">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

// ══════════════════════════════════════════════════════════
// Modal de firmas
// ══════════════════════════════════════════════════════════
interface IntegranteHint {
  nombre?: string;
  cedula?: string;
  cargo?: string;
}

function FirmaModal({
  comite,
  actaId,
  presidenteSugerido,
  secretarioSugerido,
  onClose,
  onFirmado,
}: {
  comite: ComiteSlug;
  actaId: string;
  presidenteSugerido?: IntegranteHint;
  secretarioSugerido?: IntegranteHint;
  onClose: () => void;
  onFirmado: () => void;
}) {
  const [presNombre, setPresNombre] = useState(
    presidenteSugerido?.nombre || ""
  );
  const [presCedula, setPresCedula] = useState(
    presidenteSugerido?.cedula || ""
  );
  const [presCargo, setPresCargo] = useState(presidenteSugerido?.cargo || "");
  const [secNombre, setSecNombre] = useState(
    secretarioSugerido?.nombre || ""
  );
  const [secCedula, setSecCedula] = useState(
    secretarioSugerido?.cedula || ""
  );
  const [secCargo, setSecCargo] = useState(secretarioSugerido?.cargo || "");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const presRef = useRef<HTMLCanvasElement>(null);
  const secRef = useRef<HTMLCanvasElement>(null);

  const setupCanvas = (c: HTMLCanvasElement | null) => {
    if (!c) return;
    const ctx = c.getContext("2d")!;
    let drawing = false;
    const start = (e: PointerEvent) => {
      drawing = true;
      const r = c.getBoundingClientRect();
      ctx.beginPath();
      ctx.moveTo(e.clientX - r.left, e.clientY - r.top);
    };
    const move = (e: PointerEvent) => {
      if (!drawing) return;
      const r = c.getBoundingClientRect();
      ctx.lineTo(e.clientX - r.left, e.clientY - r.top);
      ctx.lineWidth = 2;
      ctx.strokeStyle = "#0a0a0a";
      ctx.lineCap = "round";
      ctx.stroke();
    };
    const end = () => (drawing = false);
    c.onpointerdown = start;
    c.onpointermove = move;
    c.onpointerup = end;
    c.onpointerleave = end;
  };

  useEffect(() => {
    setupCanvas(presRef.current);
    setupCanvas(secRef.current);
  }, []);

  const limpiar = (c: HTMLCanvasElement | null) => {
    if (!c) return;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
  };

  const isCanvasEmpty = (c: HTMLCanvasElement | null): boolean => {
    if (!c) return true;
    const ctx = c.getContext("2d")!;
    const data = ctx.getImageData(0, 0, c.width, c.height).data;
    for (let i = 3; i < data.length; i += 4) if (data[i] !== 0) return false;
    return true;
  };

  const firmar = async () => {
    setErr("");
    if (!presNombre || !presCedula || !secNombre || !secCedula) {
      setErr("Complete nombre y cédula de presidente y secretario(a)");
      return;
    }
    if (isCanvasEmpty(presRef.current) || isCanvasEmpty(secRef.current)) {
      setErr("Ambas firmas son obligatorias");
      return;
    }
    setBusy(true);
    try {
      const payload = {
        presidente: {
          rol: "presidente",
          nombre: presNombre,
          cedula: presCedula,
          cargo: presCargo,
          signatureDataUrl: presRef.current!.toDataURL("image/png"),
        },
        secretario: {
          rol: "secretaria",
          nombre: secNombre,
          cedula: secCedula,
          cargo: secCargo,
          signatureDataUrl: secRef.current!.toDataURL("image/png"),
        },
      };
      const r = await fetch(`/api/${comite}/actas/${actaId}/firmar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const j = await r.json();
      if (!r.ok || !j.success) {
        setErr(j.message || "Error al firmar");
        setBusy(false);
        return;
      }
      onFirmado();
    } catch {
      setErr("Error de red");
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl max-w-3xl w-full p-6 my-8">
        <h3 className="text-xl font-bold text-white mb-4">Firma del acta</h3>

        <div className="grid md:grid-cols-2 gap-4">
          <FirmaPanel
            titulo="Presidente(a)"
            nombre={presNombre}
            setNombre={setPresNombre}
            cedula={presCedula}
            setCedula={setPresCedula}
            cargo={presCargo}
            setCargo={setPresCargo}
            canvasRef={presRef}
            onClear={() => limpiar(presRef.current)}
          />
          <FirmaPanel
            titulo={comite === "cocolab" ? "Secretaria" : "Secretario(a)"}
            nombre={secNombre}
            setNombre={setSecNombre}
            cedula={secCedula}
            setCedula={setSecCedula}
            cargo={secCargo}
            setCargo={setSecCargo}
            canvasRef={secRef}
            onClear={() => limpiar(secRef.current)}
          />
        </div>

        {err && (
          <div className="mt-4 flex items-center gap-2 text-red-300 bg-red-500/20 border border-red-400/30 px-3 py-2 rounded-lg text-sm">
            <AlertCircle className="w-4 h-4" />
            {err}
          </div>
        )}

        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 border border-white/15 text-white/90 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={firmar}
            disabled={busy}
            className="inline-flex items-center gap-2 px-5 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:opacity-50 transition-colors"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            Confirmar firma
          </button>
        </div>
      </div>
    </div>
  );
}

function FirmaPanel({
  titulo,
  nombre,
  setNombre,
  cedula,
  setCedula,
  cargo,
  setCargo,
  canvasRef,
  onClear,
}: {
  titulo: string;
  nombre: string;
  setNombre: (v: string) => void;
  cedula: string;
  setCedula: (v: string) => void;
  cargo: string;
  setCargo: (v: string) => void;
  canvasRef: React.RefObject<HTMLCanvasElement | null>;
  onClear: () => void;
}) {
  return (
    <div className="bg-white/5 rounded-xl p-4 border border-white/10">
      <h4 className="text-white font-semibold mb-3">{titulo}</h4>
      <div className="space-y-2 mb-3">
        <input
          placeholder="Nombre completo"
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40 focus:bg-white/10 focus:border-white/20 outline-none transition-colors"
        />
        <input
          placeholder="Cédula"
          value={cedula}
          onChange={(e) => setCedula(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40 focus:bg-white/10 focus:border-white/20 outline-none transition-colors"
        />
        <input
          placeholder="Cargo"
          value={cargo}
          onChange={(e) => setCargo(e.target.value)}
          className="w-full px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-white text-sm placeholder:text-white/40 focus:bg-white/10 focus:border-white/20 outline-none transition-colors"
        />
      </div>
      <div className="bg-white rounded-lg">
        <canvas
          ref={canvasRef}
          width={400}
          height={130}
          className="w-full touch-none cursor-crosshair"
        />
      </div>
      <div className="flex gap-2 mt-2">
        <button
          type="button"
          onClick={onClear}
          className="flex-1 inline-flex items-center justify-center gap-1 text-xs bg-white/10 hover:bg-white/15 border border-white/15 text-white px-3 py-1.5 rounded-lg transition-colors"
        >
          <Eraser className="w-3.5 h-3.5" /> Limpiar
        </button>
        <span className="flex-1 inline-flex items-center justify-center gap-1 text-xs text-white/50">
          <PenTool className="w-3.5 h-3.5" /> Firme dentro del recuadro
        </span>
      </div>
    </div>
  );
}
