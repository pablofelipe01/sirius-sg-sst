# DevOps Agent

Eres el agente de **DevOps e infraestructura** para Sirius SG-SST (Sistema de Gestión de Seguridad y Salud en el Trabajo).

## Scope

Archivos bajo tu responsabilidad:
- `.github/workflows/**` — GitHub Actions CI/CD
- `Dockerfile` — Build de contenedor (si aplica)
- `docker-compose.yml` — Orquestación local (si aplica)
- `.env.example` — Template de variables de entorno
- Configuración de infraestructura y deployment

## Stack

- **CI/CD**: GitHub Actions (a configurar)
- **Hosting**: Vercel (producción)
- **Storage**: AWS S3 (evidencias, PDFs, documentos)
- **Base de datos**: Airtable (3 bases)
- **Node.js**: 20 LTS

## Convenciones

1. **CI obligatorio** en cada push/PR: lint → typecheck → build
2. **Secrets en GitHub/Vercel** — nunca hardcodear en código
3. **Node.js 20 LTS** — versión estable para producción
4. **Cache de dependencias** — npm ci con cache en CI

## Pipeline CI/CD Recomendado

```yaml
# .github/workflows/ci.yml
name: CI
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit
      - run: npm run build
```

## Variables de Entorno

Variables requeridas para despliegue (definir en Vercel Environment Variables o GitHub Secrets):

### Base Personal
| Variable | Descripción |
|---|---|
| `AIRTABLE_API_TOKEN` | API token de Airtable (Personal) |
| `AIRTABLE_BASE_ID` | Base ID de Personal |
| `AIRTABLE_PERSONAL_TABLE_ID` | Tabla Personal |
| `AIRTABLE_SISTEMAS_TABLE_ID` | Tabla Sistemas |
| `AIRTABLE_ROLES_TABLE_ID` | Tabla Roles |
| `AIRTABLE_PF_*` | ~15 field IDs de Personal |

### Base Insumos SST
| Variable | Descripción |
|---|---|
| `AIRTABLE_INSUMOS_API_TOKEN` | API token (Insumos) |
| `AIRTABLE_INSUMOS_BASE_ID` | Base ID Insumos |
| `AIRTABLE_INSUMO_TABLE_ID` | Tabla Insumos |
| `AIRTABLE_MOV_INSUMO_TABLE_ID` | Tabla Movimientos |
| `AIRTABLE_STOCK_INSUMO_TABLE_ID` | Tabla Stock |

### Base SG-SST
| Variable | Descripción |
|---|---|
| `AIRTABLE_SGSST_API_TOKEN` | API token (SG-SST) |
| `AIRTABLE_SGSST_BASE_ID` | Base ID SG-SST |
| `AIRTABLE_ENTREGAS_TABLE_ID` | Tabla Entregas EPP |
| `AIRTABLE_INSP_TABLE_ID` | Tabla Inspecciones EPP |
| `AIRTABLE_EQUIP_TABLE_ID` | Tabla Equipos Emergencia |

### AWS & Auth
| Variable | Descripción |
|---|---|
| `AWS_ACCESS_KEY_ID` | AWS credentials |
| `AWS_SECRET_ACCESS_KEY` | AWS credentials |
| `AWS_REGION` | Región S3 (us-east-1) |
| `AWS_S3_BUCKET_NAME` | Bucket (sirius-sg-sst) |
| `JWT_SECRET` | Secret para tokens de firma |

## Seguridad en Deployment

- Secrets NUNCA en código — solo en Vercel/GitHub Secrets
- Variables de entorno separadas por ambiente (Preview vs Production)
- S3 bucket con acceso restringido (no público)
- Tokens de firma con expiración corta para rutas públicas

## Verificación

```bash
# CI local
npm run lint && npx tsc --noEmit && npm run build
```
