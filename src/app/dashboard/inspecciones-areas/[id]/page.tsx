"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import {
  ChevronLeft,
  Loader2,
  AlertTriangle,
  Calendar,
  User,
  MapPin,
  FileText,
  ShieldCheck,
  CheckCircle,
  Camera,
  X,
} from "lucide-react";
import { guardarEnGaleria } from "@/shared/utils";

interface CriterioDetalle {
  id: string;
  categoria: string;
  criterio: string;
  condicion: string;
  observacion: string;
  fotoUrl: string | null;
}

interface AccionDetalle {
  id: string;
  descripcion: string;
  tipo: string;
  responsable: string;
  fechaPropuesta: string;
  estado: string;
  fechaCierre: string | null;
  evidenciaUrl: string | null;
}

interface ResponsableDetalle {
  id: string;
  tipo: string;
  nombre: string;
  cedula: string;
  cargo: string;
  fechaFirma: string;
  tieneFirma: boolean;
}

interface InspeccionDetalle {
  id: string;
  recordId: string;
  fecha: string;
  inspector: string;
  area: string;
  estado: string;
  observaciones: string;
  urlDocumento: string | null;
  fechaExportacion: string | null;
  fotoUrls: string[];
  criterios: CriterioDetalle[];
  acciones: AccionDetalle[];
  responsables: ResponsableDetalle[];
}

const CONDICION_STYLE: Record<string, string> = {
  Bueno: "bg-green-500/20 text-green-300 border-green-400/30",
  Malo: "bg-red-500/20 text-red-300 border-red-400/30",
  NA: "bg-gray-500/20 text-gray-300 border-gray-400/30",
};

function formatFecha(fecha: string | null | undefined): string {
  if (!fecha) return "Sin fecha";
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return "Sin fecha";
  return d.toLocaleDateString("es-CO", {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "America/Bogota",
  });
}

export default function InspeccionAreaDetallePage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const inspeccionId = useMemo(() => params?.id ?? "", [params]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<InspeccionDetalle | null>(null);

  // Fotos de evidencia
  const [fotoUploading, setFotoUploading] = useState(false);
  const [fotoError, setFotoError] = useState<string | null>(null);
  const [localFotoUrls, setLocalFotoUrls] = useState<string[]>([]);
  const fotoInputRef = useRef<HTMLInputElement>(null);

  // Sincronizar fotos cuando se carga el detalle
  useEffect(() => {
    if (data?.fotoUrls) setLocalFotoUrls(data.fotoUrls);
  }, [data?.fotoUrls]);

  const handleAgregarFoto = async (file: File) => {
    if (!data?.recordId) return;
    if (localFotoUrls.length >= 3) return;
    if (!file.type.match(/^image\/(jpeg|png|webp)$/)) {
      setFotoError("Solo se permiten imágenes JPG, PNG o WebP");
      return;
    }
    setFotoUploading(true);
    setFotoError(null);
    try {
      const presignRes = await fetch("/api/inspecciones-areas/fotos/presign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inspeccionRecordId: data.recordId,
          fotos: [{ name: file.name, type: file.type, size: file.size }],
        }),
      });
      const presignData = await presignRes.json();
      if (!presignData.success) throw new Error(presignData.message);
      const { key, uploadUrl } = presignData.uploads[0];
      await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      const saveRes = await fetch("/api/inspecciones-areas/fotos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspeccionRecordId: data.recordId, s3Keys: [key] }),
      });
      const saveData = await saveRes.json();
      if (!saveData.success) throw new Error(saveData.message);
      setLocalFotoUrls(saveData.fotoUrls ?? [...localFotoUrls, saveData.url ?? ""]);
    } catch (err) {
      setFotoError(err instanceof Error ? err.message : "Error al subir foto");
    } finally {
      setFotoUploading(false);
    }
  };

  const handleEliminarFoto = async (s3Key: string) => {
    if (!data?.recordId) return;
    try {
      const res = await fetch("/api/inspecciones-areas/fotos", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspeccionRecordId: data.recordId, s3Key }),
      });
      const json = await res.json();
      if (json.success) {
        setLocalFotoUrls((prev) => prev.filter((url) => !url.includes(s3Key.split("/").pop()!)));
      }
    } catch (err) {
      console.error("Error al eliminar foto:", err);
    }
  };

  useEffect(() => {
    const cargarDetalle = async () => {
      if (!inspeccionId) {
        setError("No se recibió un identificador de inspección.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        const res = await fetch(`/api/inspecciones-areas/${encodeURIComponent(inspeccionId)}`, {
          cache: "no-store",
        });
        const json = await res.json();

        if (!res.ok || !json.success) {
          throw new Error(json.message || "No fue posible cargar el detalle de la inspección.");
        }

        setData(json.data as InspeccionDetalle);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Error desconocido cargando el detalle.");
      } finally {
        setLoading(false);
      }
    };

    cargarDetalle();
  }, [inspeccionId]);

  const criteriosPorCategoria = useMemo(() => {
    const grouped: Record<string, CriterioDetalle[]> = {};
    for (const criterio of data?.criterios ?? []) {
      if (!grouped[criterio.categoria]) grouped[criterio.categoria] = [];
      grouped[criterio.categoria].push(criterio);
    }
    return grouped;
  }, [data?.criterios]);

  return (
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
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/dashboard/inspecciones-areas/historial")}
                className="p-2 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-blue-500/20 backdrop-blur-sm">
                  <MapPin className="w-6 h-6 text-blue-400" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-white">Detalle de Inspección de Área</h1>
                  <p className="text-xs text-white/60">{inspeccionId || "Inspección"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {loading ? (
          <div className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-10 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-blue-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="bg-red-500/20 border border-red-500/30 rounded-xl p-4 text-white flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-300 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">No se pudo cargar la inspección</p>
              <p className="text-sm text-white/80 mt-1">{error}</p>
            </div>
          </div>
        ) : data ? (
          <>
            <section className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Información general</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 text-sm">
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-white/50">ID</p>
                  <p className="text-white font-semibold">{data.id}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-white/50 flex items-center gap-1"><Calendar size={13} /> Fecha</p>
                  <p className="text-white font-semibold">{formatFecha(data.fecha)}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-white/50 flex items-center gap-1"><User size={13} /> Inspector</p>
                  <p className="text-white font-semibold">{data.inspector || "Sin inspector"}</p>
                </div>
                <div className="bg-white/5 rounded-lg p-3 border border-white/10">
                  <p className="text-white/50">Área / Estado</p>
                  <p className="text-white font-semibold">{data.area} · {data.estado}</p>
                </div>
              </div>
            </section>

            <section className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <FileText className="w-5 h-5 text-blue-400" />
                Criterios evaluados
              </h2>
              <div className="space-y-4">
                {Object.entries(criteriosPorCategoria).map(([categoria, criterios]) => (
                  <div key={categoria} className="space-y-2">
                    <h3 className="text-sm font-semibold text-white/80 bg-white/5 px-3 py-1.5 rounded-lg">
                      {categoria}
                    </h3>
                    <div className="space-y-1">
                      {criterios.map((c) => (
                        <div key={c.id} className="grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr] gap-2 p-3 rounded-lg bg-white/5 border border-white/10">
                          <p className="text-sm text-white/90">{c.criterio}</p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[11px] font-semibold border w-fit ${CONDICION_STYLE[c.condicion] || "bg-white/10 text-white/70 border-white/20"}`}
                          >
                            {c.condicion || "Sin condición"}
                          </span>
                          <p className="text-xs text-white/70">{c.observacion || "Sin observación"}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4">Acciones correctivas</h2>
              {data.acciones.length === 0 ? (
                <p className="text-sm text-white/60">No hay acciones correctivas registradas.</p>
              ) : (
                <div className="space-y-2">
                  {data.acciones.map((accion) => (
                    <div key={accion.id} className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm space-y-1">
                      <p className="text-white font-medium">{accion.descripcion}</p>
                      <p className="text-white/70">Tipo: {accion.tipo} · Responsable: {accion.responsable || "No definido"}</p>
                      <p className="text-white/60">Propuesta: {formatFecha(accion.fechaPropuesta)} · Estado: {accion.estado}</p>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-blue-400" />
                Responsables y firma
              </h2>
              {data.responsables.length === 0 ? (
                <p className="text-sm text-white/60">No hay responsables registrados.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {data.responsables.map((responsable) => (
                    <div key={responsable.id} className="p-3 rounded-lg bg-white/5 border border-white/10 text-sm space-y-1">
                      <p className="text-white font-semibold">{responsable.tipo}</p>
                      <p className="text-white/80">{responsable.nombre}</p>
                      <p className="text-white/60">Cédula: {responsable.cedula || "N/A"}</p>
                      <p className="text-white/60">Cargo: {responsable.cargo || "N/A"}</p>
                      <p className="text-white/60">Firma: {formatFecha(responsable.fechaFirma)}</p>
                      <div className="pt-1">
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border bg-white/10 text-white/80 border-white/20">
                          <CheckCircle size={12} className={responsable.tieneFirma ? "text-green-400" : "text-yellow-300"} />
                          {responsable.tieneFirma ? "Firma registrada" : "Sin firma"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <h2 className="text-lg font-semibold text-white mb-2">Observaciones generales</h2>
              <p className="text-sm text-white/80 whitespace-pre-wrap">{data.observaciones || "Sin observaciones"}</p>
            </section>

            {/* Evidencias Fotográficas */}
            <section className="bg-white/10 backdrop-blur-xl rounded-2xl border border-white/10 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Camera className="w-5 h-5 text-purple-400" />
                  Evidencias Fotográficas
                </h2>
                {localFotoUrls.length < 3 && (
                  <button
                    type="button"
                    disabled={fotoUploading}
                    onClick={() => fotoInputRef.current?.click()}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/20 border border-purple-400/30 text-purple-300 text-sm font-medium hover:bg-purple-500/30 transition-all cursor-pointer disabled:opacity-50"
                  >
                    {fotoUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                    Agregar foto
                  </button>
                )}
              </div>
              <input
                ref={fotoInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) {
                    guardarEnGaleria(file);
                    handleAgregarFoto(file);
                  }
                  e.target.value = "";
                }}
              />
              {fotoError && (
                <p className="text-sm text-red-300 mb-3">{fotoError}</p>
              )}
              {localFotoUrls.length === 0 ? (
                <p className="text-sm text-white/50">No hay evidencias fotográficas registradas.</p>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {localFotoUrls.map((url, idx) => {
                    const keyPart = url.split("/").slice(-2).join("/");
                    return (
                      <div key={idx} className="relative group w-32 h-32 rounded-lg overflow-hidden border border-white/20">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Evidencia ${idx + 1}`} className="w-full h-full object-cover" />
                        <button
                          type="button"
                          onClick={() => handleEliminarFoto(keyPart)}
                          className="absolute top-1 right-1 p-1 rounded-full bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity text-white"
                          title="Eliminar foto"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
