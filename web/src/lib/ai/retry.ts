const MAX_RETRIES = 5;
const RETRY_DELAY_MS = 3000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function analyzeWithRetry<T>(
  fn: (previousErrors: string[]) => Promise<T>,
  options?: { maxRetries?: number; delayMs?: number },
): Promise<{ result: T; attempts: number; errors: string[] }> {
  const max = options?.maxRetries ?? MAX_RETRIES;
  const delay = options?.delayMs ?? RETRY_DELAY_MS;
  const errors: string[] = [];

  for (let attempt = 1; attempt <= max; attempt++) {
    try {
      const result = await fn(errors);
      return { result, attempts: attempt, errors };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Error desconocido";
      errors.push(`Intento ${attempt}/${max}: ${msg}`);

      if (attempt < max) {
        await sleep(delay);
      }
    }
  }

  throw new AggregateError(errors, `Análisis AI falló tras ${max} intentos`);
}
