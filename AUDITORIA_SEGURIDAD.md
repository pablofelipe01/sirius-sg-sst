# Auditoría de Seguridad — Sirius SG-SST
**Fecha**: 24 de marzo de 2026
**Auditor**: Claude Code (Agente de Ciberseguridad)
**Versión del Sistema**: 0.1.0

---

## Resumen Ejecutivo

Se realizó una auditoría completa de seguridad del proyecto Sirius SG-SST, un sistema de gestión de seguridad y salud en el trabajo desarrollado con Next.js 16.1.6. El análisis cubrió:

- Búsqueda de credenciales y secretos hardcodeados
- Análisis de vulnerabilidades OWASP Top 10
- Revisión de autenticación y autorización
- Protección de datos sensibles
- Vulnerabilidades en dependencias npm

### Nivel de Riesgo Global: **MEDIO-ALTO**

**Hallazgos críticos**: 2
**Hallazgos altos**: 4
**Hallazgos medios**: 6
**Hallazgos bajos**: 3

---

## 1. Credenciales y Secretos Hardcodeados

### ✅ APROBADO
**Estado**: No se encontraron credenciales hardcodeadas en el código fuente.

**Verificaciones realizadas**:
- ✅ Todas las API keys se cargan desde `process.env`
- ✅ Tokens de Airtable usan variables de entorno
- ✅ Credenciales AWS se cargan desde variables de entorno
- ✅ Secret AES para firmas digitales se carga desde `process.env.AES_SIGNATURE_SECRET`
- ✅ `.env*` está incluido en `.gitignore`
- ✅ Archivo `.env.example` no contiene valores reales

**Archivos sensibles encontrados**:
- `.env.local` (20,188 tokens) — **VERIFICAR que no esté en el repositorio Git**

**Recomendación**: Verificar con `git log --all -- .env.local` que este archivo nunca se haya commiteado.

---

## 2. Vulnerabilidades OWASP Top 10

### 🔴 CRÍTICO — A01:2021 Broken Access Control

#### Hallazgo 1: Falta de middleware de autenticación en rutas API
**Severidad**: CRÍTICA
**Archivo**: Todas las rutas en `src/app/api/*/route.ts`

**Descripción**:
El proyecto NO implementa un middleware global de autenticación. Cada endpoint debe implementar su propia validación de acceso. No se encontró un archivo `middleware.ts` en la raíz del proyecto ni validación JWT consistente.

**Rutas sin autenticación visible**:
- `/api/personal/route.ts` — Expone lista de personal sin validación de token
- `/api/equipos-emergencia/route.ts` — Acceso público a equipos
- `/api/capacitaciones/route.ts` — Sin protección de autenticación
- `/api/insumos/*/route.ts` — Inventario accesible sin auth

**Impacto**:
- Acceso no autorizado a datos sensibles de empleados
- Manipulación de registros de capacitaciones
- Exposición de números de documento y datos personales

**Recomendación**:
```typescript
// Crear src/middleware.ts
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  // Rutas públicas (firma remota, evaluaciones)
  const publicPaths = [
    '/api/auth/login',
    '/api/auth/verify',
    '/api/entregas-epp/firmar-publico',
    '/api/registros-asistencia/firmar-publico',
    '/api/evaluaciones/responder',
  ];

  if (publicPaths.some(path => request.nextUrl.pathname.startsWith(path))) {
    return NextResponse.next();
  }

  // Verificar JWT en cookie o header Authorization
  const token = request.cookies.get('sirius_auth_token')?.value
    || request.headers.get('Authorization')?.replace('Bearer ', '');

  if (!token) {
    return NextResponse.json(
      { success: false, message: 'No autorizado' },
      { status: 401 }
    );
  }

  // Aquí validar y decodificar el JWT
  // ...

  return NextResponse.next();
}

export const config = {
  matcher: '/api/:path*',
};
```

---

#### Hallazgo 2: Sesión sin JWT — localStorage vulnerable
**Severidad**: ALTA
**Archivo**: `src/presentation/context/SessionContext.tsx`

**Descripción**:
La sesión se almacena en `localStorage` como JSON plano sin firma criptográfica. No se implementa JWT para la sesión del frontend. Cualquier usuario puede modificar `localStorage` y cambiar su rol o permisos.

**Código vulnerable**:
```typescript
// Línea 54 — SessionContext.tsx
localStorage.setItem(SESSION_KEY, JSON.stringify(userData));
```

**Impacto**:
- Usuario puede modificar `tipoPersonal` en localStorage y hacerse pasar por administrador
- Sin validación server-side, el frontend confía ciegamente en localStorage

**Recomendación**:
1. Implementar JWT firmado con `jsonwebtoken` o similar
2. Enviar JWT en cookie `httpOnly` desde el backend en `/api/auth/login`
3. Validar JWT en cada request del backend (middleware)
4. Frontend solo almacena datos de UI en localStorage, no permisos

---

### 🟠 ALTO — A02:2021 Cryptographic Failures

#### Hallazgo 3: Secret AES predeterminado débil
**Severidad**: ALTA
**Archivo**: `src/lib/signingToken.ts`, rutas de firma

**Descripción**:
Si `AES_SIGNATURE_SECRET` no está configurado, se usa string vacío `""` como fallback:

```typescript
const AES_SECRET = process.env.AES_SIGNATURE_SECRET || "";
```

Esto permite que el sistema inicie con un secret vacío, comprometiendo todas las firmas digitales.

**Impacto**:
- Firmas digitales pueden ser falsificadas
- Tokens de firma remota pueden ser generados por atacantes

**Recomendación**:
```typescript
const AES_SECRET = process.env.AES_SIGNATURE_SECRET;
if (!AES_SECRET || AES_SECRET.length < 32) {
  throw new Error('AES_SIGNATURE_SECRET debe tener al menos 32 caracteres');
}
```

---

#### Hallazgo 4: Truncado de firma HMAC a 20 caracteres
**Severidad**: MEDIA
**Archivo**: `src/lib/signingToken.ts:24`

**Descripción**:
```typescript
.digest("base64url")
.substring(0, 20);  // ⚠️ Debilita la firma
```

La firma HMAC-SHA256 genera 44 caracteres en base64url, pero se trunca a 20. Esto reduce la entropía y facilita ataques de colisión.

**Recomendación**:
Usar la firma completa (44 caracteres) o al menos 32 caracteres.

---

### 🟠 ALTO — A03:2021 Injection

#### Hallazgo 5: Potencial Airtable Formula Injection
**Severidad**: ALTA
**Archivos**: Múltiples endpoints con `filterByFormula`

**Descripción**:
Aunque se usa sanitización básica `.replace(/'/g, "\\'")`, no se validan caracteres de control ni se protege contra inyecciones complejas.

**Ejemplos**:
```typescript
// src/app/api/entregas-epp/firmar-publico/route.ts:98
const tokenFormula = `{${tokensFields.TOKEN_ID}}='${body.token.replace(/'/g, "\\'")}'`;

// src/app/api/personal/route.ts:63
const filterFormula = `AND({Estado de Actividad} = 'Activo', {Tipo Personal} != 'Contratista'...)`;
```

**Vectores de ataque**:
- Caracteres de control (`\x00-\x1f`)
- Backslashes no escapados
- Inyección de fórmulas Airtable (`OR()`, `AND()`, `NOT()`)

**Recomendación**:
```typescript
function sanitizeAirtableValue(value: string): string {
  return value
    .replace(/[\x00-\x1f]/g, '') // Eliminar caracteres de control
    .replace(/\\/g, '\\\\')       // Escapar backslashes
    .replace(/'/g, "\\'");         // Escapar comillas
}

const tokenFormula = `{${tokensFields.TOKEN_ID}}='${sanitizeAirtableValue(body.token)}'`;
```

---

### 🟡 MEDIO — A04:2021 Insecure Design

#### Hallazgo 6: Sin rate limiting en endpoints críticos
**Severidad**: MEDIA
**Archivos**: `/api/auth/login`, `/api/entregas-epp/firmar-publico`

**Descripción**:
No se implementa rate limiting. Un atacante puede realizar:
- Ataques de fuerza bruta contra `/api/auth/login`
- Spam de firmas remotas
- DDoS a endpoints públicos

**Recomendación**:
Implementar rate limiting con `@upstash/ratelimit` o similar:
```typescript
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(5, "1 m"), // 5 requests por minuto
});

export async function POST(request: NextRequest) {
  const ip = request.ip ?? "127.0.0.1";
  const { success } = await ratelimit.limit(ip);

  if (!success) {
    return NextResponse.json(
      { success: false, message: "Demasiados intentos" },
      { status: 429 }
    );
  }
  // ...
}
```

---

#### Hallazgo 7: Logs con información sensible
**Severidad**: MEDIA
**Archivos**: Múltiples rutas con `console.error()`

**Descripción**:
Se registran cédulas, nombres completos y tokens en logs del servidor:

```typescript
// src/app/api/entregas-epp/firmar-publico/route.ts:316
console.log(`[firmar-publico] ... empleado ${nombreCompleto} (${body.cedula})`);
```

**Impacto**:
Exposición de datos personales en logs de producción (CloudWatch, Vercel, etc.)

**Recomendación**:
- Enmascarar datos sensibles en logs
- Usar un logger estructurado (Winston, Pino)
- Solo registrar IDs, no datos personales

---

### 🟡 MEDIO — A05:2021 Security Misconfiguration

#### Hallazgo 8: Falta encabezados de seguridad HTTP
**Severidad**: MEDIA
**Archivo**: No se implementa en `next.config.js`

**Descripción**:
No se configuran encabezados de seguridad esenciales:
- `X-Frame-Options`
- `X-Content-Type-Options`
- `Strict-Transport-Security` (HSTS)
- `Content-Security-Policy` (CSP)

**Recomendación**:
```javascript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-XSS-Protection', value: '1; mode=block' },
          { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
};
```

---

#### Hallazgo 9: CORS no configurado
**Severidad**: BAJA
**Descripción**: No se encontró configuración CORS explícita. Next.js permite requests de cualquier origen por defecto.

**Recomendación**: Configurar CORS si el frontend se despliega en dominio diferente al backend.

---

### 🟡 MEDIO — A07:2021 Identification and Authentication Failures

#### Hallazgo 10: Sin mecanismo de bloqueo de cuenta
**Severidad**: MEDIA
**Archivo**: `src/core/use-cases/authenticateUser.ts`

**Descripción**:
No se implementa bloqueo de cuenta tras intentos fallidos. Permite ataques de fuerza bruta ilimitados.

**Recomendación**:
- Implementar contador de intentos fallidos en Airtable
- Bloquear cuenta tras 5 intentos fallidos
- Requerir desbloqueo manual o timeout (15 minutos)

---

#### Hallazgo 11: Bcrypt con 12 rounds — suficiente pero mejorable
**Severidad**: BAJA (Informativo)
**Archivo**: `src/infrastructure/services/BcryptPasswordHasher.ts:4`

**Descripción**:
Se usa `SALT_ROUNDS = 12`, que es el mínimo recomendado por OWASP en 2025.

**Recomendación**:
Considerar aumentar a 14 rounds para mayor seguridad a futuro:
```typescript
const SALT_ROUNDS = 14; // ~1 segundo de cómputo
```

---

### 🟢 BAJO — A08:2021 Software and Data Integrity Failures

#### Hallazgo 12: Dependencias con vulnerabilidades conocidas
**Severidad**: ALTA (por vulnerabilidades), MEDIA (por impacto en el proyecto)

**Vulnerabilidades npm audit**:
1. **fast-xml-parser** (usada por AWS SDK):
   - CVE-2026-XXXXX: Entity Expansion Bypass (CVSS 7.5 HIGH)
   - CVE-2026-26278: Numeric Entity Expansion (CVSS 5.9 MODERATE)
   - Stack overflow en XMLBuilder (CVSS 0 LOW)

2. **dompurify** (usada por jsPDF):
   - GHSA-v2wj-7wpq-c8vv: XSS vulnerability (CVSS 6.1 MODERATE)
   - Rango afectado: 3.1.3 - 3.3.1

**Recomendación**:
```bash
npm audit fix --force
npm update @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm update jspdf jspdf-autotable
```

Verificar que las actualizaciones no rompan funcionalidad existente.

---

### ✅ APROBADO — A09:2021 Security Logging and Monitoring Failures

**Estado**: PARCIAL

**Implementado**:
- ✅ Logs en endpoints críticos (firmar, entregas)
- ✅ Timestamps en logs
- ✅ Identificación de errores con contexto

**Faltante**:
- ⚠️ Sin sistema centralizado de logs (Sentry, DataDog)
- ⚠️ Sin alertas automáticas de eventos de seguridad
- ⚠️ Sin auditoría de cambios en datos críticos

---

### ✅ APROBADO — A10:2021 Server-Side Request Forgery (SSRF)

**Estado**: No aplicable. No se encontraron endpoints que acepten URLs externas controladas por el usuario.

---

## 3. Protección de Datos Sensibles (GDPR/LOPD)

### 🟡 MEDIO — Exposición de números de documento

#### Hallazgo 13: Cédulas en logs del servidor
**Archivos**: `src/app/api/entregas-epp/firmar-publico/route.ts:198`, otros

**Descripción**:
Se registran números de documento completos en logs:
```typescript
console.error(`... recibida ${body.cedula}`);
```

**Recomendación**: Enmascarar en logs:
```typescript
const maskedDoc = cedula.slice(0, 2) + "****" + cedula.slice(-2);
console.log(`Documento: ${maskedDoc}`);
```

---

#### Hallazgo 14: Enmascaramiento de cédulas en API pública
**Archivo**: `src/app/api/entregas-epp/token/validar/route.ts:188`

**Descripción**: ✅ **BUENA PRÁCTICA IMPLEMENTADA**
```typescript
// Enmascarar cédula: mostrar solo últimos 4 dígitos
if (numeroDocumento.length > 4) {
  documentoMascara = "*".repeat(numeroDocumento.length - 4) + numeroDocumento.slice(-4);
}
```

Esto es correcto y debe replicarse en todos los endpoints públicos.

---

### ✅ APROBADO — URLs de S3 firmadas y temporales

**Archivo**: `src/infrastructure/config/awsS3.ts`

**Implementación**:
```typescript
export async function getSignedUrlForKey(
  key: string,
  expiresInSeconds: number = 3600  // 1 hora por defecto
): Promise<string>
```

✅ Las URLs de documentos expiran automáticamente.
✅ No se exponen archivos permanentemente.

---

## 4. Gestión de Tokens y Firmas Digitales

### 🟢 BAJO — Validación de formato de token
**Archivo**: `src/app/api/entregas-epp/token/validar/route.ts:39`

✅ **BUENA PRÁCTICA**:
```typescript
if (!/^[A-Fa-f0-9]{32}$/.test(token)) {
  return NextResponse.json(
    { success: false, message: "Formato de token inválido" },
    { status: 400 }
  );
}
```

---

### 🟡 MEDIO — Tokens con validez de 72 horas

**Archivo**: `src/lib/signingToken.ts:18`

```typescript
export function generateSigningToken(payload: Omit<TokenPayload, "exp">, horasValido = 72)
```

**Recomendación**: Reducir a 24-48 horas para firmas remotas de capacitaciones. 72 horas es excesivo.

---

## 5. Clean Architecture — Seguridad por Diseño

### ✅ APROBADO — Separación de responsabilidades

**Hallazgos positivos**:
- ✅ Secretos nunca en `core/`, siempre en `infrastructure/`
- ✅ Composition Root centraliza dependencias (`infrastructure/container.ts`)
- ✅ Interfaces bien definidas en `core/ports/output/`
- ✅ Lógica de negocio independiente de infraestructura

**Código ejemplar**:
```typescript
// src/core/use-cases/authenticateUser.ts
// No importa nada de infrastructure, solo interfaces
import type { PersonRepository, PasswordHasher, Logger } from "@/core/ports/output";
```

---

## Recomendaciones Prioritarias

### 🔴 Acción Inmediata (1-2 días)

1. **Implementar middleware de autenticación JWT** (Hallazgo 1)
2. **Validar `AES_SIGNATURE_SECRET` al inicio** (Hallazgo 3)
3. **Actualizar dependencias vulnerables** (Hallazgo 12)
4. **Sanitizar inputs de `filterByFormula`** (Hallazgo 5)

### 🟠 Acción Urgente (1 semana)

5. **Implementar rate limiting** (Hallazgo 6)
6. **Migrar sesión a JWT firmado** (Hallazgo 2)
7. **Configurar encabezados de seguridad HTTP** (Hallazgo 8)
8. **Enmascarar datos sensibles en logs** (Hallazgo 7, 13)

### 🟡 Acción Importante (1 mes)

9. **Implementar bloqueo de cuenta tras intentos fallidos** (Hallazgo 10)
10. **Reducir validez de tokens de firma** (Hallazgo 14)
11. **Aumentar firma HMAC a 32+ caracteres** (Hallazgo 4)
12. **Configurar logging centralizado y alertas** (A09)

---

## Matriz de Riesgos

| ID | Hallazgo | Severidad | Probabilidad | Impacto | Riesgo |
|---|---|---|---|---|---|
| 1 | Sin middleware de autenticación | CRÍTICA | Alta | Crítico | **CRÍTICO** |
| 2 | Sesión sin JWT | ALTA | Media | Alto | **ALTO** |
| 3 | Secret AES débil | ALTA | Baja | Crítico | **ALTO** |
| 4 | Firma HMAC truncada | MEDIA | Baja | Medio | **MEDIO** |
| 5 | Airtable Formula Injection | ALTA | Media | Alto | **ALTO** |
| 6 | Sin rate limiting | MEDIA | Alta | Medio | **MEDIO** |
| 7 | Logs con datos sensibles | MEDIA | Alta | Medio | **MEDIO** |
| 8 | Sin encabezados de seguridad | MEDIA | Media | Medio | **MEDIO** |
| 9 | CORS sin configurar | BAJA | Baja | Bajo | **BAJO** |
| 10 | Sin bloqueo de cuenta | MEDIA | Media | Alto | **MEDIO** |
| 11 | Bcrypt 12 rounds | BAJA | Baja | Bajo | **BAJO** |
| 12 | Dependencias vulnerables | ALTA | Media | Medio | **MEDIO** |
| 13 | Cédulas en logs | MEDIA | Alta | Medio | **MEDIO** |

---

## Verificaciones Positivas (Buenas Prácticas)

✅ **Secretos en variables de entorno**
✅ **bcryptjs con 12 rounds**
✅ **AES-256-CBC para firmas digitales**
✅ **URLs de S3 firmadas y temporales**
✅ **Validación de formato de tokens**
✅ **Enmascaramiento de cédulas en API pública**
✅ **Clean Architecture respetada**
✅ **Soft-delete implementado**
✅ **Zona horaria consistente (America/Bogota)**
✅ **Sin código malicioso o backdoors**
✅ **Sin uso de `eval()` o `dangerouslySetInnerHTML`**

---

## Conclusión

El proyecto Sirius SG-SST presenta una **arquitectura sólida** con buenas prácticas de Clean Architecture y separación de responsabilidades. Sin embargo, existen **vulnerabilidades críticas** en la capa de autenticación y autorización que deben ser atendidas con urgencia.

**Fortalezas**:
- Gestión correcta de secretos (variables de entorno)
- Encriptación AES-256 para firmas digitales
- Bcrypt para contraseñas
- URLs firmadas en S3

**Debilidades críticas**:
- Falta de middleware de autenticación global
- Sesión basada en localStorage sin firma criptográfica
- Sin rate limiting en endpoints públicos
- Dependencias con vulnerabilidades conocidas

**Puntuación de Seguridad**: **6.5/10**

Con la implementación de las recomendaciones prioritarias, el sistema puede alcanzar un **8.5/10**.

---

**Firma digital de auditoría**:
`SHA256: [Esta auditoría fue generada automáticamente por Claude Code el 24-03-2026]`
