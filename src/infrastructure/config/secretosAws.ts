// Variables que no caben en Vercel (límite de 64 KB) viven en AWS Secrets
// Manager. Se leen antes del build (scripts/cargar-env-aws.ts) y al arrancar
// el servidor (src/instrumentation.ts). Sin ENV_SECRET_IDS no hace nada.
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from "@aws-sdk/client-secrets-manager";

export async function leerSecretosAws(): Promise<Record<string, string>> {
  const ids = (process.env.ENV_SECRET_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return {};

  // Credenciales con nombre propio: Vercel reserva AWS_ACCESS_KEY_ID y compañía.
  const client = new SecretsManagerClient({
    region: process.env.SST_SECRETS_REGION,
    credentials: {
      accessKeyId: process.env.SST_SECRETS_ACCESS_KEY_ID!,
      secretAccessKey: process.env.SST_SECRETS_SECRET_ACCESS_KEY!,
    },
  });

  const partes = await Promise.all(
    ids.map(async (id) => {
      try {
        const { SecretString } = await client.send(
          new GetSecretValueCommand({ SecretId: id })
        );
        return JSON.parse(SecretString ?? "{}") as Record<string, string>;
      } catch (error) {
        throw new Error(`No se pudo leer el secreto "${id}" de AWS Secrets Manager`, {
          cause: error,
        });
      }
    })
  );

  return Object.assign({}, ...partes);
}
