import { InvokeCommand, LambdaClient } from "@aws-sdk/client-lambda";

const local = process.env.STAGE === "local";
const client = new LambdaClient({
  region: process.env.AWS_REGION || "us-east-1",
  maxAttempts: 1,
  ...(local ? {
    endpoint: process.env.AWS_ENDPOINT_URL || "http://taller-aws-localstack:4566",
    credentials: { accessKeyId: "test", secretAccessKey: "test" },
  } : {}),
});

export interface InvokeResult<T> { statusCode: number; body: T }

export async function invokeLambda<T>(functionName: string, event: object): Promise<InvokeResult<T>> {
  const response = await client.send(new InvokeCommand({
    FunctionName: functionName,
    InvocationType: "RequestResponse",
    Payload: Buffer.from(JSON.stringify(event)),
  }));
  if (response.FunctionError) {
    const failure = response.Payload ? JSON.parse(Buffer.from(response.Payload).toString("utf8")) : {};
    throw new Error(`Falló la invocación de ${functionName}: ${failure.errorType || response.FunctionError}`);
  }
  if (!response.Payload) throw new Error(`Respuesta vacía de ${functionName}`);
  const result = JSON.parse(Buffer.from(response.Payload).toString("utf8"));
  if (typeof result.statusCode !== "number" || typeof result.body !== "string") throw new Error(`Respuesta inválida de ${functionName}`);
  return { statusCode: result.statusCode, body: JSON.parse(result.body) as T };
}

export const productsFN = (name: string) => `taller-${process.env.STAGE || "local"}-Products-${name}`;
