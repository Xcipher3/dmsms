import env from "@/env";

const GATEWAY_TIMEOUT_MS = 10_000;

export class BlastaGatewayError extends Error {
  constructor(message = "Blasta gateway unreachable") {
    super(message);
    this.name = "BlastaGatewayError";
  }
}

export interface BlastaReply {
  status: number;
  body: Record<string, unknown>;
}

export async function callBlasta(
  endpoint: string,
  body: unknown,
  authToken?: string,
): Promise<BlastaReply> {
  let response: Response;
  try {
    response = await fetch(`${env.BLASTA_BASE_URL}${endpoint}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { authToken } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(GATEWAY_TIMEOUT_MS),
    });
  }
  catch {
    throw new BlastaGatewayError();
  }

  try {
    const parsed = await response.json() as Record<string, unknown>;
    return { status: response.status, body: parsed };
  }
  catch {
    throw new BlastaGatewayError("Blasta gateway returned an invalid response");
  }
}
