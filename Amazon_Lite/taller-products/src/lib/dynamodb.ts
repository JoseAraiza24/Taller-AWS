import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient } from "@aws-sdk/lib-dynamodb";

const local = process.env.STAGE === "local";
const client = new DynamoDBClient({
  region: process.env.AWS_REGION || "us-east-1",
  ...(local
    ? {
        endpoint: process.env.AWS_ENDPOINT_URL || "http://taller-aws-localstack:4566",
        credentials: { accessKeyId: "test", secretAccessKey: "test" },
      }
    : {}),
});

export const dynamo = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
});
