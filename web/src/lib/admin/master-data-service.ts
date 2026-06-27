import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import { getMasterDataEntity, MASTER_DATA_ENTITIES, quoteSqlIdentifier, type MasterDataEntity } from "@/lib/admin/master-data";

type RawRow = Record<string, unknown>;
type MasterDataValue = string | number | boolean | null;

function nowIso() {
  return new Date().toISOString();
}

function editableColumns(entity: MasterDataEntity) {
  return entity.fields.map((field) => field.name);
}

function selectColumns(entity: MasterDataEntity) {
  const columns = ["id", ...editableColumns(entity), "createdAt"];
  if (entity.hasUpdatedAt) columns.push("updatedAt");
  return columns;
}

function normalizeRow(entity: MasterDataEntity, row: RawRow) {
  const normalized: RawRow = { ...row };

  for (const field of entity.fields) {
    if (field.type === "boolean") {
      normalized[field.name] = Boolean(row[field.name]);
    }
  }

  return normalized;
}

function normalizeInputValue(field: MasterDataEntity["fields"][number], value: unknown): MasterDataValue {
  if (field.type === "boolean") {
    if (value === undefined || value === null || value === "") return Boolean(field.defaultValue);
    return value === true || value === "true" || value === 1 || value === "1";
  }

  if (field.type === "number") {
    if (value === undefined || value === null || value === "") return null;
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) throw new Error(`${field.label} debe ser numérico`);
    return parsed;
  }

  const text = typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
  if (!text) {
    if (field.required) throw new Error(`${field.label} es obligatorio`);
    return null;
  }

  if (field.type === "color" && !/^#[0-9A-Fa-f]{6}$/.test(text)) {
    throw new Error(`${field.label} debe tener formato #RRGGBB`);
  }

  if (field.options?.length && !field.options.some((option) => option.value === text)) {
    throw new Error(`${field.label} tiene un valor inválido`);
  }

  return text;
}

export async function countMasterDataRows(entity: MasterDataEntity) {
  const table = quoteSqlIdentifier(entity.tableName);
  const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(`SELECT COUNT(*) as count FROM ${table}`);
  return Number(rows[0]?.count ?? 0);
}

export async function listMasterDataEntities() {
  return Promise.all(
    MASTER_DATA_ENTITIES.map(async (entity) => ({
      key: entity.key,
      label: entity.label,
      singularLabel: entity.singularLabel,
      description: entity.description,
      count: await countMasterDataRows(entity),
    })),
  );
}

export async function listMasterDataRows(entity: MasterDataEntity) {
  const table = quoteSqlIdentifier(entity.tableName);
  const columns = selectColumns(entity).map(quoteSqlIdentifier).join(", ");
  const orderBy = quoteSqlIdentifier(entity.orderBy);
  const rows = await prisma.$queryRawUnsafe<RawRow[]>(`SELECT ${columns} FROM ${table} ORDER BY ${orderBy} ASC`);
  return rows.map((row) => normalizeRow(entity, row));
}

export async function getMasterDataRelationOptions(entity: MasterDataEntity) {
  const result: Record<string, { label: string; value: string }[]> = {};

  for (const field of entity.fields) {
    if (field.type !== "relation" || !field.relation) continue;

    const target = getMasterDataEntity(field.relation.entity);
    if (!target) continue;

    const table = quoteSqlIdentifier(target.tableName);
    const labelField = quoteSqlIdentifier(field.relation.labelField);
    const orderBy = quoteSqlIdentifier(target.orderBy);
    const rows = await prisma.$queryRawUnsafe<{ id: string; label: string }[]>(
      `SELECT "id", ${labelField} as label FROM ${table} ORDER BY ${orderBy} ASC`,
    );

    result[field.name] = rows.map((row) => ({ label: String(row.label), value: row.id }));
  }

  return result;
}

export function buildMasterDataMetadata(entity: MasterDataEntity, relationOptions: Record<string, { label: string; value: string }[]>) {
  return {
    key: entity.key,
    label: entity.label,
    singularLabel: entity.singularLabel,
    description: entity.description,
    displayField: entity.displayField,
    fields: entity.fields.map((field) => ({
      ...field,
      options: field.type === "relation" ? relationOptions[field.name] ?? [] : field.options,
    })),
    readonlyFields: ["id", "createdAt", ...(entity.hasUpdatedAt ? ["updatedAt"] : [])],
  };
}

export async function createMasterDataRow(entity: MasterDataEntity, values: Record<string, unknown>) {
  const id = randomBytes(12).toString("hex");
  const columns = ["id", ...editableColumns(entity), "createdAt"];
  const params: MasterDataValue[] = [id];

  for (const field of entity.fields) {
    params.push(normalizeInputValue(field, values[field.name]));
  }

  params.push(nowIso());

  if (entity.hasUpdatedAt) {
    columns.push("updatedAt");
    params.push(nowIso());
  }

  const table = quoteSqlIdentifier(entity.tableName);
  const sqlColumns = columns.map(quoteSqlIdentifier).join(", ");
  const placeholders = columns.map(() => "?").join(", ");
  await prisma.$executeRawUnsafe(`INSERT INTO ${table} (${sqlColumns}) VALUES (${placeholders})`, ...params);

  return { id };
}

export async function updateMasterDataRow(entity: MasterDataEntity, id: string, values: Record<string, unknown>) {
  const assignments: string[] = [];
  const params: MasterDataValue[] = [];

  for (const field of entity.fields) {
    assignments.push(`${quoteSqlIdentifier(field.name)} = ?`);
    params.push(normalizeInputValue(field, values[field.name]));
  }

  if (entity.hasUpdatedAt) {
    assignments.push(`"updatedAt" = ?`);
    params.push(nowIso());
  }

  params.push(id);

  const table = quoteSqlIdentifier(entity.tableName);
  await prisma.$executeRawUnsafe(`UPDATE ${table} SET ${assignments.join(", ")} WHERE "id" = ?`, ...params);
}

async function countWhere(tableName: string, whereColumn: string, value: string) {
  const table = quoteSqlIdentifier(tableName);
  const column = quoteSqlIdentifier(whereColumn);
  const rows = await prisma.$queryRawUnsafe<{ count: number }[]>(`SELECT COUNT(*) as count FROM ${table} WHERE ${column} = ?`, value);
  return Number(rows[0]?.count ?? 0);
}

export async function getMasterDataUsage(entity: MasterDataEntity, id: string) {
  if (entity.key === "banks") {
    const cards = await countWhere("Card", "bankId", id);
    return cards ? `El banco tiene ${cards} tarjeta(s) asociada(s).` : null;
  }

  if (entity.key === "categories") {
    const transactions = await countWhere("Transaction", "categoryId", id);
    const recurring = await countWhere("RecurringTransaction", "categoryId", id);
    const total = transactions + recurring;
    return total ? `La categoría está usada en ${total} movimiento(s) o recurrente(s).` : null;
  }

  if (entity.key === "cards") {
    const statements = await countWhere("Statement", "cardId", id);
    return statements ? `La tarjeta tiene ${statements} resumen(es) asociado(s).` : null;
  }

  if (entity.key === "currencies") {
    const table = quoteSqlIdentifier(entity.tableName);
    const rows = await prisma.$queryRawUnsafe<{ code: string }[]>(`SELECT "code" FROM ${table} WHERE "id" = ?`, id);
    const code = rows[0]?.code;
    if (!code) return null;

    const payslips = await countWhere("Payslip", "currency", code);
    const balances = await countWhere("BalanceSummary", "currency", code);
    const recurring = await countWhere("RecurringTransaction", "currency", code);
    const total = payslips + balances + recurring;
    return total ? `La moneda ${code} está usada en ${total} registro(s).` : null;
  }

  return null;
}

export async function deleteMasterDataRow(entity: MasterDataEntity, id: string) {
  const usage = await getMasterDataUsage(entity, id);
  if (usage) throw new Error(`No se puede eliminar. ${usage}`);

  const table = quoteSqlIdentifier(entity.tableName);
  await prisma.$executeRawUnsafe(`DELETE FROM ${table} WHERE "id" = ?`, id);
}
