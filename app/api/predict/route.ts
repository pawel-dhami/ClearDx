import { NextResponse } from "next/server";
import { z } from "zod";
import { getPredictor, PredictorError } from "@/lib/predict/predictor";
import { PredictInputSchema } from "@/lib/predict/schema";
import type { PredictErrorResponse, PredictResponse } from "@/lib/predict/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function error(status: number, message: string, details?: unknown) {
  return NextResponse.json<PredictErrorResponse>({ error: message, details }, { status });
}

export async function POST(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return error(400, "Request body must be JSON");
  }

  const parsed = PredictInputSchema.safeParse(body);
  if (!parsed.success) {
    return error(400, "Invalid input", z.flattenError(parsed.error));
  }

  try {
    const predictor = await getPredictor();
    const result = await predictor.predict(parsed.data, { signal: req.signal });
    return NextResponse.json<PredictResponse>({ source: predictor.source, result });
  } catch (err) {
    if (req.signal.aborted) return error(499, "Client closed request");
    if (err instanceof PredictorError) {
      console.error("[predict]", err.message, err.details ?? "");
      // Don't leak upstream bodies (may echo auth info) unless in dev.
      const details = process.env.NODE_ENV === "development" ? err.details : undefined;
      return error(err.status, err.message, details);
    }
    console.error("[predict] unexpected", err);
    return error(500, "Prediction failed");
  }
}
