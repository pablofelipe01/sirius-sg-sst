"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  Search,
  Loader2,
  CheckCircle,
  AlertTriangle,
  ClipboardList,
  X,
  Users,
  Calendar,
  User,
  FileDown,
  PenTool,
  Eraser,
  Check,
  History,
  BookOpen,
  ChevronDown,
  Mic,
  MicOff,
  Link,
  Copy,
  ExternalLink,
  Share2,
  ChevronUp,
} from "lucide-react";
import { useSession } from "@/presentation/context/SessionContext";

// ══════════════════════════════════════════════════════════
// Tipos
// ══════════════════════════════════════════════════════════
interface Capacitacion {
  id: string;
  codigo: string;
  nombre: string;
  intensidad: string;
  tipo: string; // "Presencial y Virtual" | "Presencial"
}

interface ProgramacionItem {
  id: string;
  identificador: string;
  mes: string;
  trimestre: string;
  programado: boolean;
  ejecutado: boolean;
  fechaEjecucion: string;
  totalAsistentes: number;
  capacitacionNombre: string;
  capacitacionCodigo: string;
  capacitacionCategoria: string;
  poblacionObjetivo: string;
  observaciones: string;
}

interface PersonalItem {
  id: string;
  idEmpleado: string;
  nombreCompleto: string;
  numeroDocumento: string;
  tipoPersonal: string;
  estado: string;
  fotoPerfil: { url: string; filename: string } | null;
}

interface AsistenteRow {
  id: string;
  persona: PersonalItem;
  firma: string | null;
  detalleRecordId?: string;
}

type PageStep = "form" | "asistentes";
type PageState = "idle" | "saving" | "success" | "error";

let _uid = 0;
function uid() { return `asis-${++_uid}-${Date.now()}`; }

function formatDate(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Bogota" });
}

// ══════════════════════════════════════════════════════════
// Componente Canvas de Firma
// ══════════════════════════════════════════════════════════
function SignatureCanvas({
  onConfirm,
  onCancel,
  nombrePersona,
  titulo = "Firma del Asistente",
}: {
  onConfirm: (dataUrl: string) => void;
  onCancel: () => void;
  nombrePersona: string;
  titulo?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);
  const lastPos = useRef({ x: 0, y: 0 });
  const hasStrokes = useRef(false);
  const [isEmpty, setIsEmpty] = useState(true);

  const getPos = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    if ("touches" in e) {
      const touch = e.touches[0];
      return { x: (touch.clientX - rect.left) * scaleX, y: (touch.clientY - rect.top) * scaleY };
    }
    return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
  };

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    isDrawing.current = true;
    lastPos.current = getPos(e);
    hasStrokes.current = true;
    setIsEmpty(false);
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    e.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const pos = getPos(e);
    ctx.beginPath();
    ctx.moveTo(lastPos.current.x, lastPos.current.y);
    ctx.lineTo(pos.x, pos.y);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
    lastPos.current = pos;
  };

  const stopDraw = () => { isDrawing.current = false; };

  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx || !canvasRef.current) return;
    ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    hasStrokes.current = false;
    setIsEmpty(true);
  };

  const confirmSignature = () => {
    if (!canvasRef.current || !hasStrokes.current) return;
    onConfirm(canvasRef.current.toDataURL("image/png"));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-slate-900/95 backdrop-blur-xl rounded-2xl border border-white/10 w-full max-w-md overflow-hidden">
        <div className="p-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">{titulo}</h3>
          <p className="text-sm text-white/60 mt-1">{nombrePersona}</p>
        </div>
        <div className="p-4">
          <div className="relative rounded-xl overflow-hidden border border-white/20 bg-white">
            <canvas
              ref={canvasRef}
              width={600}
              height={200}
              className="w-full h-[160px] cursor-crosshair touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            {isEmpty && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <p className="text-gray-400 text-sm flex items-center gap-2">
                  <PenTool className="w-4 h-4" /> Firme aquí
                </p>
              </div>
            )}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={clearCanvas}
              className="flex-1 py-2.5 rounded-lg bg-white/10 border border-white/15 text-white/60 text-sm font-medium hover:bg-white/15 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Eraser className="w-4 h-4" /> Limpiar
            </button>
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-lg bg-red-500/20 border border-red-400/30 text-red-300 text-sm font-medium hover:bg-red-500/30 transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <X className="w-4 h-4" /> Cancelar
            </button>
            <button
              onClick={confirmSignature}
              disabled={isEmpty}
              className="flex-1 py-2.5 rounded-lg bg-green-500/25 border border-green-400/30 text-green-300 text-sm font-semibold hover:bg-green-500/35 transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <Check className="w-4 h-4" /> Confirmar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════
// Componente principal
// ══════════════════════════════════════════════════════════
export default function NuevoRegistroPage() {
  const router = useRouter();
  const { user } = useSession();

  // Paso del flujo
  const [step, setStep] = useState<PageStep>("form");
  const [pageState, setPageState] = useState<PageState>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // IDs del registro creado
  const [registroRecordId, setRegistroRecordId] = useState<string | null>(null);
  const [registroIdLabel, setRegistroIdLabel] = useState<string>("");

  // Datos del formulario (Paso 1)
  const [nombreEvento, setNombreEvento] = useState("");
  const [ciudad, setCiudad] = useState("Barranca de Upia");
  const [fecha, setFecha] = useState(formatDate(new Date()));
  const [horaInicio, setHoraInicio] = useState("");
  const [lugar, setLugar] = useState("Oficinas de Sirius");
  const [duracion, setDuracion] = useState("");
  const [temasTratados, setTemasTratados] = useState("");
  const [nombreConferencista, setNombreConferencista] = useState("");
  const [tipoEvento, setTipoEvento] = useState("Capacitación");

  // Programación Capacitaciones (multi-selector de actividades)
  const [programaciones, setProgramaciones] = useState<ProgramacionItem[]>([]);
  const [loadingCaps, setLoadingCaps] = useState(false);
  const [capSearch, setCapSearch] = useState("");
  const [showCapDropdown, setShowCapDropdown] = useState(false);
  const [selectedProgs, setSelectedProgs] = useState<ProgramacionItem[]>([]);
  const capDropdownRef = useRef<HTMLDivElement>(null);

  // Filtro de categoría
  const [categoriaFilter, setCategoriaFilter] = useState<string>("");

  // Grabador de voz (Temas Tratados)
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  // Paso 2: lista de asistentes
  const [asistentes, setAsistentes] = useState<AsistenteRow[]>([]);
  const [loadingPersonal, setLoadingPersonal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Modal firma
  const [firmandoId, setFirmandoId] = useState<string | null>(null);
  const [firmandoConferencista, setFirmandoConferencista] = useState(false);
  const [conferencistaFirmado, setConferencistaFirmado] = useState(false);

  // Links de firma remota
  const [signingLinks, setSigningLinks] = useState<{ detalleRecordId: string; nombre: string; url: string }[] | null>(null);
  const [generatingLinks, setGeneratingLinks] = useState(false);
  const [showLinksPanel, setShowLinksPanel] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Estado de evaluación por empleado (true = evaluación aprobada, puede firmar)
  const [evalStatus, setEvalStatus] = useState<Record<string, boolean>>({});
  const [hasEvaluaciones, setHasEvaluaciones] = useState(false);
  const [loadingEvalStatus, setLoadingEvalStatus] = useState(false);

  // Persistencia de sesión + polling
  const STORAGE_KEY = "sirius-sgsst-registro-en-curso";
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  // Precargar nombre del conferencista con el usuario actual
  useEffect(() => {
    if (user?.nombreCompleto && !nombreConferencista) {
      setNombreConferencista(user.nombreCompleto);
    }
  }, [user, nombreConferencista]);

  // Cargar programaciones pendientes al montar
  const fetchProgramaciones = useCallback(async () => {
    setLoadingCaps(true);
    try {
      const res = await fetch("/api/programacion-capacitaciones");
      const json = await res.json();
      if (json.success) setProgramaciones(json.data);
    } catch {
      console.error("Error cargando programaciones");
    } finally {
      setLoadingCaps(false);
    }
  }, []);

  useEffect(() => {
    fetchProgramaciones();
  }, [fetchProgramaciones]);

  // ── Reconstruir estado desde Airtable (usado en restore + poll) ──
  const fetchRegistroState = useCallback(async (recId: string, silent = false) => {
    try {
      const res = await fetch(`/api/registros-asistencia/${recId}`);
      const json = await res.json();
      if (!json.success) return;
      const d = json.data;

      // Reconstruir filas de asistentes preservando firmas locales ya conocidas
      setAsistentes((prev) => {
        const remoteMap = new Map<string, { firmaConfirmada: boolean; nombre: string; cedula: string; labor: string; idEmpleado: string }>(
          (d.asistentes as { id: string; nombre: string; cedula: string; labor: string; idEmpleado: string; firmaConfirmada: boolean }[]).map(
            (a) => [a.id, a]
          )
        );

        if (prev.length === 0 || !silent) {
          // Primera carga: construir lista completa
          return (d.asistentes as { id: string; nombre: string; cedula: string; labor: string; idEmpleado: string; firmaConfirmada: boolean }[]).map((a) => ({
            id: uid(),
            persona: {
              id: a.id,
              idEmpleado: a.idEmpleado || "",
              nombreCompleto: a.nombre || "",
              numeroDocumento: a.cedula || "",
              tipoPersonal: a.labor || "",
              estado: "",
              fotoPerfil: null,
            },
            firma: a.firmaConfirmada ? "remote" : null,
            detalleRecordId: a.id,
          }));
        }

        // Actualización silenciosa: sólo marcar los que firmaron en remoto
        return prev.map((local) => {
          if (local.firma) return local;
          const remote = local.detalleRecordId ? remoteMap.get(local.detalleRecordId) : undefined;
          if (remote?.firmaConfirmada) return { ...local, firma: "remote" };
          return local;
        });
      });

      if (d.estado === "Finalizado") {
        setConferencistaFirmado(true);
        setPageState("success");
      }
      if (!silent) setStep("asistentes");
      setLastSync(new Date());
    } catch { /* silencioso */ }
  }, []);

  // ── Polling: actualizar firmas remotas cada 10 segundos ──
  const pollSignatures = useCallback((recId: string) => {
    fetchRegistroState(recId, true);
  }, [fetchRegistroState]);

  useEffect(() => {
    if (step !== "asistentes" || !registroRecordId || conferencistaFirmado) {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
      return;
    }
    pollingRef.current = setInterval(() => pollSignatures(registroRecordId), 10_000);
    return () => {
      if (pollingRef.current) { clearInterval(pollingRef.current); pollingRef.current = null; }
    };
  }, [step, registroRecordId, conferencistaFirmado, pollSignatures]);

  // ── Restaurar desde sessionStorage al montar (DEBE ir antes del efecto de guardado) ──
  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const data = JSON.parse(saved) as {
        registroRecordId: string;
        registroIdLabel: string;
        nombreEvento: string;
        nombreConferencista: string;
        fecha: string;
        signingLinks: { detalleRecordId: string; nombre: string; url: string }[] | null;
      };
      if (!data.registroRecordId) return;
      setRegistroRecordId(data.registroRecordId);
      setRegistroIdLabel(data.registroIdLabel || "");
      setNombreEvento(data.nombreEvento || "");
      setNombreConferencista(data.nombreConferencista || "");
      setFecha(data.fecha || formatDate(new Date()));
      if (data.signingLinks) { setSigningLinks(data.signingLinks); setShowLinksPanel(true); }
      fetchRegistroState(data.registroRecordId, false);
    } catch {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Guardar en sessionStorage cuando cambia el estado del registro ──
  // Nota: NO se limpia aquí cuando step="form" para no borrar datos antes de restaurarlos.
  // La limpieza explícita ocurre en el botón "Volver" y en firmarConferencista.
  useEffect(() => {
    if (step === "asistentes" && registroRecordId) {
      const saved = JSON.stringify({
        registroRecordId,
        registroIdLabel,
        nombreEvento,
        nombreConferencista,
        fecha,
        signingLinks,
      });
      sessionStorage.setItem(STORAGE_KEY, saved);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, registroRecordId, registroIdLabel, nombreEvento, nombreConferencista, fecha, signingLinks]);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (capDropdownRef.current && !capDropdownRef.current.contains(e.target as Node)) {
        setShowCapDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Grabación de voz → Whisper
  const toggleRecording = async () => {
    if (isRecording) {
      mediaRecorderRef.current?.stop();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "audio/webm";
      const recorder = new MediaRecorder(stream, { mimeType });
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        setIsRecording(false);
        setIsTranscribing(true);
        try {
          const blob = new Blob(audioChunksRef.current, { type: mimeType });
          const fd = new FormData();
          fd.append("audio", blob, "grabacion.webm");
          const res = await fetch("/api/transcribir", { method: "POST", body: fd });
          const json = await res.json();
          if (json.success && json.texto) {
            const texto = (json.texto as string).trim();
            if (texto) setTemasTratados((prev) => prev ? `${prev.trimEnd()}\n${texto}` : texto);
          }
        } catch {
          console.error("Error transcribiendo");
        } finally {
          setIsTranscribing(false);
        }
      };

      recorder.start();
      mediaRecorderRef.current = recorder;
      setIsRecording(true);
    } catch {
      setErrorMessage("No se pudo acceder al micrófono. Verifica los permisos.");
    }
  };

  // Paso 1 → Paso 2: Crear registros de asistencia en Airtable
  const crearRegistro = async () => {
    if (selectedProgs.length === 0) {
      setErrorMessage("Selecciona al menos una actividad programada");
      return;
    }

    setPageState("saving");
    setErrorMessage(null);
    setLoadingPersonal(true);

    try {
      // Cargar el personal activo
      const res = await fetch("/api/personal?excluir=asistencia");
      const json = await res.json();
      if (!json.success) throw new Error("Error cargando personal");

      const asistentesPayload = json.data.map((p: PersonalItem) => ({
        idEmpleado: p.idEmpleado,
        nombreCompleto: p.nombreCompleto,
        cedula: p.numeroDocumento,
        labor: p.tipoPersonal || "",
      }));

      const payload = {
        capacitacionCodigo: selectedProgs[0].capacitacionCodigo || selectedProgs[0].identificador,
        programacionRecordIds: selectedProgs.map((p) => p.id),
        eventoData: {
          ciudad,
          lugar,
          fecha,
          horaInicio,
          duracion,
          temasTratados,
          nombreConferencista,
          tipoEvento,
        },
        asistentes: asistentesPayload,
        fechaRegistro: fecha,
      };

      const createRes = await fetch("/api/registros-asistencia", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const createJson = await createRes.json();
      if (!createJson.success) throw new Error(createJson.message || "Error creando el registro");

      setRegistroRecordId(createJson.data.recordId);
      setRegistroIdLabel(createJson.data.id);

      // Construir lista local con los detalleIds retornados
      const detalleIds: string[] = createJson.data.detalleIds || [];
      const rows: AsistenteRow[] = json.data.map((p: PersonalItem, idx: number) => ({
        id: uid(),
        persona: p,
        firma: null,
        detalleRecordId: detalleIds[idx] || undefined,
      }));
      setAsistentes(rows);

      setPageState("idle");
      setStep("asistentes");
    } catch (err) {
      setPageState("error");
      setErrorMessage(err instanceof Error ? err.message : "Error desconocido");
    } finally {
      setLoadingPersonal(false);
    }
  };

  // Generar links de firma remota
  const generateSigningLinks = async () => {
    if (!registroRecordId || asistentes.length === 0) return;
    setGeneratingLinks(true);
    try {
      const origin = window.location.origin;
      const payload = {
        baseUrl: origin,
        asistentes: asistentes
          .filter((a) => !a.firma && a.detalleRecordId)
          .map((a) => ({
            detalleRecordId: a.detalleRecordId!,
            eventoRecordId: registroRecordId,
            nombre: a.persona.nombreCompleto,
            cedula: a.persona.numeroDocumento,
          })),
      };
      const res = await fetch("/api/registros-asistencia/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        setSigningLinks(json.tokens);
        setShowLinksPanel(true);
      } else {
        setErrorMessage(json.message || "Error generando enlaces");
      }
    } catch {
      setErrorMessage("Error generando los enlaces de firma");
    } finally {
      setGeneratingLinks(false);
    }
  };

  const copyLink = async (url: string, detalleRecordId: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(detalleRecordId);
      setTimeout(() => setCopiedId(null), 2000);
    } catch { /* fallback */ }
  };

  // ── Verificar estado de evaluación para todos los asistentes ──
  const fetchEvalStatus = useCallback(async () => {
    if (asistentes.length === 0 || selectedProgs.length === 0) return;
    setLoadingEvalStatus(true);
    try {
      const idEmpleadoCores = asistentes
        .map((a) => a.persona.idEmpleado)
        .filter(Boolean);
      const progCapIds = selectedProgs.map((p) => p.id);
      const res = await fetch("/api/evaluaciones/check-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idEmpleadoCores, progCapIds }),
        cache: "no-store",
      });
      const json = await res.json();
      if (json.success) {
        setEvalStatus(json.results || {});
        setHasEvaluaciones(json.hasEvaluaciones ?? false);
      }
    } catch { /* silencioso */ }
    finally { setLoadingEvalStatus(false); }
  }, [asistentes, selectedProgs]);

  // Verificar eval status cuando entramos a paso 2 y periódicamente
  useEffect(() => {
    if (step !== "asistentes" || asistentes.length === 0) return;
    fetchEvalStatus();
    // Re-check together with polling
    const interval = setInterval(fetchEvalStatus, 15_000);
    return () => clearInterval(interval);
  }, [step, asistentes.length, fetchEvalStatus]);

  // Firmar asistente
  const firmarAsistente = async (asistenteId: string, firmaDataUrl: string) => {
    const asistente = asistentes.find((a) => a.id === asistenteId);
    if (!asistente || !registroRecordId) return;

    try {
      const res = await fetch("/api/registros-asistencia/firmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "asistente",
          registroRecordId,
          detalleRecordId: asistente.detalleRecordId,
          firmaDataUrl,
          nombre: asistente.persona.nombreCompleto,
          idEmpleado: asistente.persona.idEmpleado,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAsistentes((prev) =>
          prev.map((a) => (a.id === asistenteId ? { ...a, firma: firmaDataUrl } : a))
        );
      } else {
        setErrorMessage(json.message || "Error guardando firma");
      }
    } catch {
      setErrorMessage("Error guardando firma");
    }
    setFirmandoId(null);
  };

  // Firmar conferencista y completar registro
  const firmarConferencista = async (firmaDataUrl: string) => {
    if (!registroRecordId) return;

    try {
      const res = await fetch("/api/registros-asistencia/firmar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "conferencista",
          registroRecordId,
          firmaDataUrl,
          nombre: nombreConferencista,
        }),
      });
      const json = await res.json();
      if (json.success) {
        setConferencistaFirmado(true);
        setPageState("success");
        sessionStorage.removeItem(STORAGE_KEY);
      } else {
        setErrorMessage(json.message || "Error guardando firma del conferencista");
      }
    } catch {
      setErrorMessage("Error guardando firma del conferencista");
    }
    setFirmandoConferencista(false);
  };

  // Exportar Excel
  const exportarExcel = async () => {
    if (!registroRecordId) return;
    try {
      const res = await fetch("/api/registros-asistencia/exportar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ registroRecordId }),
      });
      if (!res.ok) throw new Error("Error al generar el archivo");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Asistencia_${nombreEvento.replace(/\s+/g, "_")}_${fecha}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Error al exportar");
    }
  };

  const asistentesFiltrados = asistentes.filter(
    (a) =>
      a.persona.nombreCompleto.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.persona.numeroDocumento.includes(searchQuery)
  );

  const firmados = asistentes.filter((a) => a.firma !== null).length;
  const total = asistentes.length;

  const asistenteFirmando = firmandoId ? asistentes.find((a) => a.id === firmandoId) : null;

  // ══════════════════════════════════════════════════════════
  // Render
  // ══════════════════════════════════════════════════════════
  return (
    <div className="min-h-screen relative">
      <div className="fixed inset-0 -z-10">
        <Image src="/20032025-DSC_3717.jpg" alt="" fill className="object-cover" priority quality={85} />
        <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      </div>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/10 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => {
                if (step === "asistentes") {
                  sessionStorage.removeItem(STORAGE_KEY);
                  setStep("form");
                } else {
                  router.push("/dashboard/registros-asistencia");
                }
              }}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-purple-500/20 backdrop-blur-sm">
                  <ClipboardList className="w-6 h-6 text-purple-300" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">
                    {step === "form" ? "Nuevo Registro de Asistencia" : `Registro ${registroIdLabel}`}
                  </h1>
                  <p className="text-xs text-white/60">
                    {step === "form" ? "Paso 1 de 2 — Datos del evento" : "Paso 2 de 2 — Registro de firmas"}
                  </p>
                </div>
              </div>
            </div>
            {step === "asistentes" && (
              <div className="flex items-center gap-3">
                <button
                  onClick={() => router.push("/dashboard/registros-asistencia/historial")}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white border border-white/20 transition-all"
                >
                  <History size={18} />
                  <span className="hidden sm:inline">Historial</span>
                </button>
                <button
                  onClick={generateSigningLinks}
                  disabled={generatingLinks}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 text-white border border-blue-400/30 transition-all disabled:opacity-50"
                >
                  {generatingLinks ? <Loader2 size={18} className="animate-spin" /> : <Share2 size={18} />}
                  <span className="hidden sm:inline">Links Remotos</span>
                </button>
                <button
                  onClick={exportarExcel}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-sirius-verde/20 hover:bg-sirius-verde/30 text-white border border-sirius-verde/30 transition-all"
                >
                  <FileDown size={18} />
                  <span className="hidden sm:inline">Exportar Excel</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Mensajes */}
        {errorMessage && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/20 border border-red-500/30 text-white">
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
            <p>{errorMessage}</p>
            <button onClick={() => setErrorMessage(null)} className="ml-auto p-1 hover:bg-white/10 rounded">
              <X size={16} />
            </button>
          </div>
        )}
        {pageState === "success" && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-green-500/20 border border-green-500/30 text-white">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <p>Registro completado exitosamente. Ya puedes exportar el Excel.</p>
          </div>
        )}

        {/* ── PASO 1: FORMULARIO ────────────────────────────── */}
        {step === "form" && (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6 space-y-6">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Calendar className="w-5 h-5 text-purple-300" />
              Datos del Evento
            </h2>

            {/* Filtro por Categoría */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Categoría de capacitación
              </label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setCategoriaFilter(""); setSelectedProgs([]); }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                    categoriaFilter === ""
                      ? "bg-purple-500/30 border-purple-400/50 text-purple-200"
                      : "bg-white/10 border-white/20 text-white/50 hover:bg-white/15"
                  }`}
                >
                  Todas
                </button>
                {Array.from(
                  new Set(programaciones.map((p) => p.capacitacionCategoria).filter(Boolean))
                ).sort().map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => { setCategoriaFilter(cat); setSelectedProgs([]); }}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                      categoriaFilter === cat
                        ? "bg-purple-500/30 border-purple-400/50 text-purple-200"
                        : "bg-white/10 border-white/20 text-white/50 hover:bg-white/15"
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Selector de Programación / Capacitación */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">
                Actividad programada <span className="text-red-400">*</span>
              </label>
              <div className="relative" ref={capDropdownRef}>
                {/* Botón principal del selector */}
                <button
                  type="button"
                  onClick={() => setShowCapDropdown((v) => !v)}
                  className={`w-full px-4 py-2.5 rounded-lg border text-left flex items-center justify-between gap-2 transition-all focus:outline-none focus:ring-2 focus:ring-purple-400/50 ${
                    selectedProgs.length > 0
                      ? "bg-purple-500/20 border-purple-400/40 text-white"
                      : "bg-white/10 border-white/20 text-white/40"
                  }`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <BookOpen className="w-4 h-4 shrink-0 text-purple-300" />
                    {selectedProgs.length > 0
                      ? `${selectedProgs.length} actividad${selectedProgs.length > 1 ? "es" : ""} seleccionada${selectedProgs.length > 1 ? "s" : ""}`
                      : "Seleccionar actividad(es)..."}
                  </span>
                  {loadingCaps ? (
                    <Loader2 className="w-4 h-4 animate-spin text-white/40 shrink-0" />
                  ) : (
                    <ChevronDown className={`w-4 h-4 shrink-0 text-white/40 transition-transform ${showCapDropdown ? "rotate-180" : ""}`} />
                  )}
                </button>
                {/* Chips de actividades seleccionadas */}
                {selectedProgs.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {selectedProgs.map((p) => (
                      <span key={p.id} className="flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-full bg-purple-500/20 border border-purple-400/30 text-xs">
                        <span className="font-mono text-purple-300">{p.identificador}</span>
                        <span className="text-white/50">·</span>
                        <span className="text-white/80 truncate max-w-[180px]">{p.capacitacionNombre || p.identificador}</span>
                        <button
                          type="button"
                          onClick={() => setSelectedProgs((prev) => prev.filter((s) => s.id !== p.id))}
                          className="shrink-0 p-0.5 rounded-full hover:bg-purple-400/30 text-purple-300 transition-colors"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                {/* Dropdown */}
                {showCapDropdown && (
                  <div className="absolute z-20 mt-1 w-full bg-slate-900/95 backdrop-blur-xl border border-white/15 rounded-xl shadow-2xl overflow-hidden">
                    {/* Buscador interno */}
                    <div className="p-2 border-b border-white/10">
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white/40" />
                        <input
                          type="text"
                          autoFocus
                          value={capSearch}
                          onChange={(e) => setCapSearch(e.target.value)}
                          placeholder="Buscar programación..."
                          className="w-full pl-9 pr-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-1 focus:ring-purple-400/50"
                        />
                      </div>
                    </div>
                    {/* Lista: mostrar primero las pendientes (no ejecutadas), luego el resto */}
                    <div className="max-h-60 overflow-y-auto">
                      {(() => {
                        const filtered = programaciones.filter((p) => {
                          const matchSearch = (p.identificador + " " + p.capacitacionNombre + " " + p.mes)
                            .toLowerCase()
                            .includes(capSearch.toLowerCase());
                          const matchCat = !categoriaFilter || p.capacitacionCategoria === categoriaFilter;
                          return matchSearch && matchCat;
                        });
                        const pending   = filtered.filter((p) => p.programado && !p.ejecutado);
                        const executed  = filtered.filter((p) => p.ejecutado);
                        const others    = filtered.filter((p) => !p.programado && !p.ejecutado);
                        const sorted    = [...pending, ...others, ...executed];
                        if (sorted.length === 0) {
                          return (
                            <p className="px-4 py-3 text-sm text-white/40 text-center">
                              No se encontraron programaciones
                            </p>
                          );
                        }
                        return sorted.map((prog) => (
                          <button
                            key={prog.id}
                            type="button"
                            onClick={() => {
                              setSelectedProgs((prev) => {
                                const exists = prev.some((s) => s.id === prog.id);
                                if (exists) return prev.filter((s) => s.id !== prog.id);
                                const updated = [...prev, prog];
                                if (updated.length === 1) setNombreEvento(prog.capacitacionNombre || prog.identificador);
                                return updated;
                              });
                            }}
                            className={`w-full text-left px-4 py-2.5 text-sm hover:bg-purple-500/20 transition-colors flex items-start gap-2 ${
                              selectedProgs.some((s) => s.id === prog.id)
                                ? "bg-purple-500/25 text-purple-200"
                                : "text-white/80"
                            }`}
                          >
                            <div className={`w-4 h-4 mt-0.5 shrink-0 rounded border flex items-center justify-center transition-colors ${
                              selectedProgs.some((s) => s.id === prog.id) ? "bg-purple-500 border-purple-400" : "border-white/30"
                            }`}>
                              {selectedProgs.some((s) => s.id === prog.id) && <Check className="w-3 h-3 text-white" />}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-xs text-purple-400/70 font-mono">{prog.identificador}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/50 border border-white/10">
                                  {prog.mes} · {prog.trimestre}
                                </span>
                                {prog.ejecutado && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/20 text-green-300 border border-green-400/20">
                                    Ejecutada
                                  </span>
                                )}
                                {prog.programado && !prog.ejecutado && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-400/20">
                                    Pendiente
                                  </span>
                                )}
                              </div>
                              <span className="block truncate text-sm">{prog.capacitacionNombre || prog.identificador}</span>
                              {prog.capacitacionCodigo && (
                                <span className="block text-xs text-white/40">{prog.capacitacionCodigo}</span>
                              )}
                            </div>
                          </button>
                        ));
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tipo de Evento */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Tipo de Evento</label>
                <select
                  value={tipoEvento}
                  onChange={(e) => setTipoEvento(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                >
                  <option value="Capacitación" className="bg-slate-900">Capacitación</option>
                  <option value="Inducción" className="bg-slate-900">Inducción</option>
                  <option value="Charla" className="bg-slate-900">Charla</option>
                  <option value="Capacitaciones/Charlas" className="bg-slate-900">Capacitaciones/Charlas</option>
                </select>
              </div>
            </div>

            {/* Ciudad, Fecha, Hora */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Ciudad</label>
                <input
                  type="text"
                  value={ciudad}
                  onChange={(e) => setCiudad(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Fecha</label>
                <input
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Hora de Inicio</label>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                />
              </div>
            </div>

            {/* Lugar, Duración */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Lugar</label>
                <input
                  type="text"
                  value={lugar}
                  onChange={(e) => setLugar(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-white/70 mb-1">Duración</label>
                <input
                  type="text"
                  value={duracion}
                  onChange={(e) => setDuracion(e.target.value)}
                  placeholder="Ej: 2 horas"
                  className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
                />
              </div>
            </div>

            {/* Temas Tratados */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-white/70">Temas Tratados</label>
                <button
                  type="button"
                  onClick={toggleRecording}
                  disabled={isTranscribing}
                  title={isRecording ? "Detener grabación" : "Grabar con micrófono"}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-medium border transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                    isRecording
                      ? "bg-red-500/25 border-red-400/40 text-red-300 animate-pulse"
                      : isTranscribing
                      ? "bg-yellow-500/20 border-yellow-400/30 text-yellow-300"
                      : "bg-white/10 border-white/20 text-white/60 hover:bg-white/15 hover:text-white"
                  }`}
                >
                  {isTranscribing ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Transcribiendo...
                    </>
                  ) : isRecording ? (
                    <>
                      <MicOff className="w-3.5 h-3.5" />
                      Detener
                    </>
                  ) : (
                    <>
                      <Mic className="w-3.5 h-3.5" />
                      Dictar
                    </>
                  )}
                </button>
              </div>

              <textarea
                value={temasTratados}
                onChange={(e) => setTemasTratados(e.target.value)}
                rows={3}
                placeholder="Describe los temas que se tratarán en el evento, o usa el micrófono para dictarlos..."
                className={`w-full px-4 py-2.5 rounded-lg bg-white/10 border text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50 resize-none transition-colors ${
                  isRecording ? "border-red-400/40 ring-1 ring-red-400/30" : "border-white/20"
                }`}
              />
            </div>

            {/* Conferencista */}
            <div>
              <label className="block text-sm font-medium text-white/70 mb-1">Nombre del Conferencista</label>
              <input
                type="text"
                value={nombreConferencista}
                onChange={(e) => setNombreConferencista(e.target.value)}
                placeholder="Nombre completo del conferencista"
                className="w-full px-4 py-2.5 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50"
              />
            </div>

            {/* Botón continuar */}
            <div className="flex justify-end pt-2">
              <button
                onClick={crearRegistro}
                disabled={pageState === "saving"}
                className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-500/30 border border-purple-400/40 text-white font-semibold hover:bg-purple-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
              >
                {pageState === "saving" ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Users size={18} />
                )}
                Continuar al Registro de Asistentes
              </button>
            </div>
          </div>
        )}

        {/* ── PASO 2: REGISTRO DE ASISTENTES ───────────────── */}
        {step === "asistentes" && (
          <>
            {/* Stats */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/10 p-4">
                <p className="text-xs text-white/60">Evento</p>
                <p className="text-sm font-bold text-white truncate">{nombreEvento}</p>
              </div>
              <div className="bg-white/10 backdrop-blur-xl rounded-xl border border-white/10 p-4">
                <p className="text-xs text-white/60">Fecha</p>
                <p className="text-sm font-bold text-purple-300">{fecha}</p>
              </div>
              <div className="bg-green-500/15 backdrop-blur-xl rounded-xl border border-green-500/20 p-4">
                <p className="text-xs text-white/60">Firmados</p>
                <p className="text-2xl font-bold text-green-400">{firmados} / {total}</p>
              </div>
              <div className={`backdrop-blur-xl rounded-xl border p-4 ${conferencistaFirmado ? "bg-green-500/15 border-green-500/20" : "bg-white/10 border-white/10"}`}>
                <p className="text-xs text-white/60">Conferencista</p>
                <p className={`text-sm font-bold ${conferencistaFirmado ? "text-green-400" : "text-white/60"}`}>
                  {conferencistaFirmado ? "✓ Firmado" : "Pendiente"}
                </p>
              </div>
            </div>

            {/* Banner: evaluación requerida antes de firmar */}
            {hasEvaluaciones && (
              <div className="bg-amber-500/10 backdrop-blur-xl rounded-xl border border-amber-400/25 p-4 flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-semibold text-amber-200">Evaluación obligatoria</p>
                  <p className="text-xs text-white/60 mt-0.5">
                    Los asistentes deben completar y <strong className="text-white/80">aprobar la evaluación</strong> antes de poder firmar.
                    Genera los <strong className="text-white/80">Links Remotos</strong> para que cada asistente presente su evaluación y firme desde su dispositivo.
                  </p>
                  {loadingEvalStatus && (
                    <p className="text-xs text-amber-300/60 mt-1 flex items-center gap-1">
                      <Loader2 className="w-3 h-3 animate-spin" /> Verificando estado de evaluaciones…
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Panel de Links Remotos */}
            {signingLinks && signingLinks.length > 0 && (
              <div className="bg-blue-500/10 backdrop-blur-xl rounded-2xl border border-blue-400/25 overflow-hidden">
                <button
                  onClick={() => setShowLinksPanel((v) => !v)}
                  className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-blue-500/15 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-blue-500/20">
                      <Link className="w-4 h-4 text-blue-300" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-white">Enlaces de Firma Remota</p>
                      <p className="text-xs text-white/60">{signingLinks.length} asistentes pendientes · Válidos por 72 horas</p>
                    </div>
                  </div>
                  {showLinksPanel ? <ChevronUp className="w-4 h-4 text-white/50" /> : <ChevronDown className="w-4 h-4 text-white/50" />}
                </button>
                {showLinksPanel && (
                  <div className="border-t border-blue-400/15 divide-y divide-white/5">
                    {signingLinks.map((item) => (
                      <div key={item.detalleRecordId} className="px-5 py-3 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-white truncate">{item.nombre}</p>
                          <p className="text-xs text-white/40 truncate">{item.url}</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => copyLink(item.url, item.detalleRecordId)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs text-white border border-white/15 transition-all cursor-pointer"
                          >
                            {copiedId === item.detalleRecordId ? (
                              <><CheckCircle className="w-3 h-3 text-green-400" /> Copiado</>
                            ) : (
                              <><Copy className="w-3 h-3" /> Copiar</>
                            )}
                          </button>
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 border border-white/15 text-white/60 hover:text-white transition-all"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Barra de búsqueda */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-300" />
                  Lista de Asistentes ({asistentesFiltrados.length})
                </h2>
                {lastSync && (
                  <span className="flex items-center gap-1.5 text-[11px] text-white/40">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                    Última sincronización: {new Date(lastSync).toLocaleTimeString("es-CO", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                  </span>
                )}
              </div>
              <div className="relative w-full sm:w-72">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar asistente..."
                  className="w-full pl-10 pr-4 py-2 rounded-lg bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-purple-400/50 text-sm"
                />
              </div>
            </div>

            {/* Tabla de asistentes */}
            {loadingPersonal ? (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-12 flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-purple-300 animate-spin" />
              </div>
            ) : (
              <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[600px]">
                    <thead>
                      <tr className="bg-purple-500/20 border-b border-white/10">
                        <th className="text-left text-xs font-semibold text-white/80 px-3 py-3 w-10">#</th>
                        <th className="text-left text-xs font-semibold text-white/80 px-3 py-3">Nombres y Apellidos</th>
                        <th className="text-left text-xs font-semibold text-white/80 px-3 py-3 w-36">No. de Cédula</th>
                        <th className="text-left text-xs font-semibold text-white/80 px-3 py-3 w-36">Labor</th>
                        <th className="text-center text-xs font-semibold text-white/80 px-3 py-3 w-28">Firma</th>
                      </tr>
                    </thead>
                    <tbody>
                      {asistentesFiltrados.map((asistente, idx) => (
                        <tr
                          key={asistente.id}
                          className={`border-b border-white/5 hover:bg-white/5 transition-colors ${asistente.firma ? "bg-green-500/5" : ""}`}
                        >
                          <td className="px-3 py-3 text-white/60 text-sm">{idx + 1}</td>
                          <td className="px-3 py-3">
                            <div className="flex items-center gap-2">
                              {asistente.persona.fotoPerfil ? (
                                <Image
                                  src={asistente.persona.fotoPerfil.url}
                                  alt=""
                                  width={32}
                                  height={32}
                                  className="w-8 h-8 rounded-full object-cover"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-full bg-purple-500/20 flex items-center justify-center">
                                  <User className="w-4 h-4 text-white/60" />
                                </div>
                              )}
                              <div>
                                <p className="text-sm font-medium text-white">{asistente.persona.nombreCompleto}</p>
                                <p className="text-xs text-white/50">{asistente.persona.tipoPersonal}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3 text-sm text-white/70">{asistente.persona.numeroDocumento}</td>
                          <td className="px-3 py-3 text-sm text-white/70">{asistente.persona.tipoPersonal}</td>
                          <td className="px-3 py-3 text-center">
                            {asistente.firma ? (
                              <div className="flex items-center justify-center gap-1 flex-wrap">
                                <CheckCircle className="w-4 h-4 text-green-400" />
                                <span className="text-xs text-green-400 font-medium">Firmado</span>
                                {asistente.firma === "remote" && (
                                  <span className="bg-blue-500/20 text-blue-300 text-[10px] px-1.5 py-0.5 rounded border border-blue-400/25">Remoto</span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center justify-center gap-1.5 flex-wrap">
                                {/* Block signing if eval required but not completed */}
                                {hasEvaluaciones && !evalStatus[asistente.persona.idEmpleado] ? (
                                  <span className="flex items-center gap-1 px-2 py-1.5 rounded bg-amber-500/15 border border-amber-400/25 text-amber-300 text-[11px]" title="Debe completar la evaluación antes de firmar">
                                    <AlertTriangle className="w-3 h-3" />
                                    Pendiente eval.
                                  </span>
                                ) : (
                                  <button
                                    onClick={() => setFirmandoId(asistente.id)}
                                    className="flex items-center justify-center gap-1 px-3 py-1.5 rounded bg-purple-500/20 border border-purple-400/30 text-purple-300 text-xs font-medium hover:bg-purple-500/30 transition-all cursor-pointer"
                                  >
                                    <PenTool className="w-3 h-3" />
                                    Firmar
                                  </button>
                                )}
                                {signingLinks && (() => {
                                  const link = signingLinks.find((l) => l.detalleRecordId === asistente.detalleRecordId);
                                  if (!link) return null;
                                  return (
                                    <button
                                      onClick={() => copyLink(link.url, link.detalleRecordId)}
                                      title="Copiar enlace remoto"
                                      className="flex items-center justify-center gap-1 px-2 py-1.5 rounded bg-blue-500/15 border border-blue-400/25 text-blue-300 text-xs hover:bg-blue-500/25 transition-all cursor-pointer"
                                    >
                                      {copiedId === link.detalleRecordId ? <CheckCircle className="w-3 h-3 text-green-400" /> : <Link className="w-3 h-3" />}
                                    </button>
                                  );
                                })()}
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Sección firma del conferencista */}
            <div className={`bg-white/10 backdrop-blur-xl rounded-2xl border p-6 ${conferencistaFirmado ? "border-green-500/30" : "border-white/10"}`}>
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-purple-300" />
                Firma del Conferencista
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white font-medium">{nombreConferencista || "—"}</p>
                  <p className="text-sm text-white/50 mt-0.5">
                    {conferencistaFirmado
                      ? "Firmado — El registro quedará marcado como Completado"
                      : "Firmar al finalizar el evento para completar el registro"}
                  </p>
                </div>
                {conferencistaFirmado ? (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-6 h-6" />
                    <span className="font-semibold">Completado</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setFirmandoConferencista(true)}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-500/25 border border-purple-400/35 text-purple-200 font-semibold hover:bg-purple-500/35 transition-all cursor-pointer"
                  >
                    <PenTool className="w-4 h-4" />
                    Firmar y Completar
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </main>

      {/* Modal firma asistente */}
      {asistenteFirmando && (
        <SignatureCanvas
          nombrePersona={asistenteFirmando.persona.nombreCompleto}
          onConfirm={(dataUrl) => firmarAsistente(asistenteFirmando.id, dataUrl)}
          onCancel={() => setFirmandoId(null)}
        />
      )}

      {/* Modal firma conferencista */}
      {firmandoConferencista && (
        <SignatureCanvas
          titulo="Firma del Conferencista"
          nombrePersona={nombreConferencista || "Conferencista"}
          onConfirm={firmarConferencista}
          onCancel={() => setFirmandoConferencista(false)}
        />
      )}
    </div>
  );
}
