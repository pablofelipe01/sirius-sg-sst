// Next.js ejecuta register() una vez al arrancar cada servidor y lo espera
// antes de atender peticiones. Aquí se cargan las variables que no caben en
// Vercel (límite de 64 KB) desde AWS Secrets Manager. En local, sin
// ENV_SECRET_IDS, no hace nada y rige .env.local.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;

  const ids = (process.env.ENV_SECRET_IDS ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) return;

  const { SecretsManagerClient, GetSecretValueCommand } = await import(
    "@aws-sdk/client-secrets-manager"
  );

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

  // El secreto manda: el runtime de Vercel define sus propias AWS_* y S3
  // necesita las de la cuenta de la empresa.
  for (const valores of partes) Object.assign(process.env, valores);
}
