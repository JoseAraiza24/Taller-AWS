import { GetCommand } from "@aws-sdk/lib-dynamodb";
import { dynamo } from "./dynamodb";
import type { Product } from "../types/product";

export const productsTable = (): string => {
  if (!process.env.PRODUCTS_TABLE) throw new Error("PRODUCTS_TABLE no está configurada");
  return process.env.PRODUCTS_TABLE;
};
export const getStoredProduct = async (productId: string): Promise<Product | undefined> => {
  const result = await dynamo.send(new GetCommand({ TableName: productsTable(), Key: { productId }, ConsistentRead: true }));
  return result.Item as Product | undefined;
};
export const parseBody = (body: string | null): Record<string, unknown> | null => {
  try {
    const data: unknown = JSON.parse(body || "{}");
    return data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
  } catch { return null; }
};
export const validateFields = (body: Record<string, unknown>, partial = false): string | null => {
  const fields = ["name", "description", "price", "stock"];
  if (!partial && fields.some((key) => body[key] === undefined)) return "Se requieren name, description, price y stock";
  if (partial && !fields.some((key) => body[key] !== undefined)) return "Debes enviar al menos un campo del producto";
  for (const field of ["name", "description"]) {
    if (body[field] !== undefined && (typeof body[field] !== "string" || !(body[field] as string).trim())) return `${field} debe ser un texto no vacío`;
  }
  if (body.price !== undefined && (typeof body.price !== "number" || !Number.isFinite(body.price) || body.price <= 0)) return "El precio debe ser un número mayor a cero";
  if (body.stock !== undefined && (typeof body.stock !== "number" || !Number.isInteger(body.stock) || body.stock < 0)) return "El stock debe ser un entero mayor o igual a cero";
  return null;
};
export const logError = (operation: string, error: unknown) => console.error(operation, error instanceof Error ? error.name : "UnknownError");
