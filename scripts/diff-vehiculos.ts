#!/usr/bin/env tsx
/**
 * Compara el estado actual de Airtable contra la tabla de referencia.
 * SOLO LECTURA: no escribe nada, únicamente reporta el plan de corrección.
 */

import { config } from 'dotenv';
import { resolve } from 'path';
config({ path: resolve(process.cwd(), '.env.local') });

import { REFERENCIA, type VehiculoRef } from './datos-vehiculos-referencia';

const META = 'https://api.airtable.com/v0/meta/bases';
const API = 'https://api.airtable.com/v0';
const TOKEN = process.env.AIRTABLE_SGSST_API_TOKEN!;
const BASE = process.env.AIRTABLE_SGSST_BASE_ID!;
const T_VEH = process.env.AIRTABLE_VEH_VEHICULOS_TABLE_ID!;
const T_DOC = process.env.AIRTABLE_VEH_DOCUMENTOS_TABLE_ID!;
const T_LIC = process.env.AIRTABLE_VEH_LICENCIAS_TABLE_ID!;

type Field = { id: string; name: string; type: string };
type Table = { id: string; name: string; fields: Field[] };

async function esquema(): Promise<Table[]> {
  const res = await fetch(`${META}/${BASE}/tables`, { headers: { Authorization: `Bearer ${TOKEN}` } });
  if (!res.ok) throw new Error(`Metadata: ${res.status}`);
  return (await res.json()).tables;
}

async function registros(tableId: string) {
  const out: any[] = [];
  let offset: string | undefined;
  do {
    const p = new URLSearchParams({ pageSize: '100' });
    if (offset) p.set('offset', offset);
    const res = await fetch(`${API}/${BASE}/${tableId}?${p}`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    if (!res.ok) throw new Error(`${tableId}: ${res.status}`);
    const d = await res.json();
    out.push(...d.records);
    offset = d.offset;
  } while (offset);
  return out;
}

const eq = (a: unknown, b: unknown) =>
  String(a ?? '').normalize('NFC').trim() === String(b ?? '').normalize('NFC').trim();

// Tres opciones de select de este módulo están grabadas con U+FFFD en vez de la
// vocal acentuada y Airtable no deja renombrarlas por API. Los tipos se comparan
// ignorando ese carácter para no reportar diferencias que no existen.
const esqueleto = (s: string) => s.toLowerCase().normalize('NFC').replace(/[áéíóúñü�]/g, '?');
const eqTipo = (a: unknown, b: unknown) =>
  esqueleto(String(a ?? '').trim()) === esqueleto(String(b ?? '').trim());

async function main() {
  const tablas = await esquema();
  const campos = (id: string) => tablas.find((t) => t.id === id)?.fields ?? [];
  const nombreCampo = (id: string, pred: (f: Field) => boolean) => campos(id).find(pred)?.name;

  const F_LINK = nombreCampo(T_DOC, (f) => f.type === 'multipleRecordLinks')!;
  console.log(`(campo de enlace en veh_documentos: "${F_LINK}")\n`);

  const vehiculos = await registros(T_VEH);
  const documentos = await registros(T_DOC);
  const licencias = await registros(T_LIC);

  const porPlaca = new Map<string, any>();
  const placasDuplicadas: string[] = [];
  for (const v of vehiculos) {
    const placa = String(v.fields['Placa'] ?? '').toUpperCase();
    if (porPlaca.has(placa)) placasDuplicadas.push(placa);
    else porPlaca.set(placa, v);
  }

  const refPorPlaca = new Map(REFERENCIA.map((r) => [r.placa, r]));

  // ── 1. Vehículos sobrantes ────────────────────────────────
  console.log('═══ 1. VEHÍCULOS QUE SOBRAN (no están en la tabla) ═══\n');
  const sobrantes = vehiculos.filter((v) => !refPorPlaca.has(String(v.fields['Placa'] ?? '').toUpperCase()));
  if (!sobrantes.length) console.log('  ninguno\n');
  for (const v of sobrantes) {
    console.log(`  ${v.id} | placa="${v.fields['Placa']}" | pers=${v.fields['ID_Personal_Core']} | prop="${v.fields['Propietario_Nombre']}"`);
  }
  if (placasDuplicadas.length) console.log(`\n  ⚠ placas duplicadas: ${placasDuplicadas.join(', ')}`);

  // ── 2. Vehículos faltantes ────────────────────────────────
  console.log('\n\n═══ 2. VEHÍCULOS QUE FALTAN ═══\n');
  const faltantes = REFERENCIA.filter((r) => !porPlaca.has(r.placa));
  if (!faltantes.length) console.log('  ninguno\n');
  for (const r of faltantes) {
    console.log(`  ${r.placa} (${r.tipo}) → ${r.idPersonal} ${r.colaborador} | prop="${r.propietarioNombre}" doc=${r.propietarioDocumento || '—'}`);
  }

  // ── 3. Campos a corregir ──────────────────────────────────
  console.log('\n\n═══ 3. CAMPOS DEL VEHÍCULO A CORREGIR ═══\n');
  let correcciones = 0;
  for (const r of REFERENCIA) {
    const v = porPlaca.get(r.placa);
    if (!v) continue;
    const f = v.fields;
    const cambios: string[] = [];
    if (!eqTipo(f['Tipo_Vehiculo'], r.tipo)) cambios.push(`tipo: "${f['Tipo_Vehiculo']}" → "${r.tipo}"`);
    if (!eq(f['Propietario_Nombre'], r.propietarioNombre)) cambios.push(`propietario: "${f['Propietario_Nombre']}" → "${r.propietarioNombre}"`);
    if (!eq(f['Propietario_Documento'], r.propietarioDocumento)) cambios.push(`documento: "${f['Propietario_Documento'] ?? ''}" → "${r.propietarioDocumento}"`);
    if (!eq(f['Propietario_Tipo'], r.propietarioTipo)) cambios.push(`tipoProp: "${f['Propietario_Tipo']}" → "${r.propietarioTipo}"`);
    if (!eq(f['ID_Personal_Core'], r.idPersonal)) cambios.push(`persona: "${f['ID_Personal_Core']}" → "${r.idPersonal}"`);
    if (cambios.length) {
      correcciones++;
      console.log(`  ${r.placa} (${r.colaborador})`);
      cambios.forEach((c) => console.log(`      ${c}`));
    }
  }
  if (!correcciones) console.log('  ninguno\n');

  // ── 4. Documentos ─────────────────────────────────────────
  console.log('\n\n═══ 4. DOCUMENTOS (SOAT / Tecnomecánica) ═══\n');
  const docsPorVehiculo = new Map<string, any[]>();
  const huerfanos: any[] = [];
  for (const d of documentos) {
    const link = (d.fields[F_LINK] ?? [])[0];
    if (!link) { huerfanos.push(d); continue; }
    if (!docsPorVehiculo.has(link)) docsPorVehiculo.set(link, []);
    docsPorVehiculo.get(link)!.push(d);
  }

  let docsOk = 0;
  const docsBorrar: { id: string; motivo: string }[] = [];
  const docsCrear: string[] = [];
  const docsActualizar: { id: string; de: string; a: string; que: string }[] = [];

  for (const r of REFERENCIA) {
    const v = porPlaca.get(r.placa);
    if (!v) continue;
    const propios = docsPorVehiculo.get(v.id) ?? [];
    for (const [tipo, esperada] of [['SOAT', r.soat], ['Tecnomecánica', r.tecno]] as const) {
      const delTipo = propios.filter((d) => eqTipo(d.fields['Tipo_Documento'], tipo));
      if (!delTipo.length) {
        if (esperada) docsCrear.push(`${r.placa} · ${tipo} · ${esperada}`);
        continue;
      }
      // el primero se conserva, el resto sobra
      const [conservar, ...extra] = delTipo;
      extra.forEach((d) => docsBorrar.push({ id: d.id, motivo: `${r.placa} ${tipo} duplicado` }));
      const actual = conservar.fields['Fecha_Vencimiento'];
      if (esperada && !eq(actual, esperada)) {
        docsActualizar.push({ id: conservar.id, de: String(actual ?? '—'), a: esperada, que: `${r.placa} ${tipo}` });
      } else docsOk++;
    }
  }

  console.log(`  correctos: ${docsOk}`);
  console.log(`  huérfanos (sin vehículo): ${huerfanos.length}`);
  console.log(`\n  a CREAR (${docsCrear.length}):`);
  docsCrear.forEach((d) => console.log(`      ${d}`));
  console.log(`\n  a CORREGIR fecha (${docsActualizar.length}):`);
  docsActualizar.forEach((d) => console.log(`      ${d.que}: ${d.de} → ${d.a}`));
  console.log(`\n  a BORRAR por duplicado (${docsBorrar.length}):`);
  docsBorrar.forEach((d) => console.log(`      ${d.id}  ${d.motivo}`));

  // ── 5. Licencias ──────────────────────────────────────────
  console.log('\n\n═══ 5. LICENCIAS ═══\n');
  const licPorPersona = new Map<string, any[]>();
  for (const l of licencias) {
    const k = String(l.fields['ID_Personal_Core'] ?? '');
    if (!licPorPersona.has(k)) licPorPersona.set(k, []);
    licPorPersona.get(k)!.push(l);
  }

  const licRef = new Map<string, { nombre: string; vence: string | null }>();
  for (const r of REFERENCIA) licRef.set(r.idPersonal, { nombre: r.colaborador, vence: r.licencia });

  for (const [idPersonal, { nombre, vence }] of licRef) {
    const actuales = licPorPersona.get(idPersonal) ?? [];
    if (!actuales.length) {
      console.log(`  FALTA   ${idPersonal} ${nombre} → ${vence ?? '(sin fecha en la tabla)'}`);
      continue;
    }
    const [conservar, ...extra] = actuales;
    const actual = conservar.fields['Fecha_Vencimiento'];
    const estado = vence && !eq(actual, vence) ? `CORREGIR ${actual} → ${vence}` : 'ok';
    console.log(`  ${estado.padEnd(28)} ${idPersonal} ${nombre}${extra.length ? `  ⚠ ${extra.length} duplicado(s): ${extra.map((e) => e.id).join(', ')}` : ''}`);
  }

  const huerfanasLic = [...licPorPersona.keys()].filter((k) => !licRef.has(k));
  if (huerfanasLic.length) console.log(`\n  licencias de personas fuera de la tabla: ${huerfanasLic.join(', ')}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
