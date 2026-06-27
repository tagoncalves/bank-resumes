export type MasterDataInputType = "text" | "number" | "boolean" | "select" | "relation" | "color" | "icon";

export type MasterDataField = {
  name: string;
  label: string;
  type: MasterDataInputType;
  required?: boolean;
  defaultValue?: string | number | boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  relation?: {
    entity: string;
    labelField: string;
  };
};

export type MasterDataEntity = {
  key: string;
  label: string;
  singularLabel: string;
  description: string;
  tableName: string;
  orderBy: string;
  displayField: string;
  fields: MasterDataField[];
  readonlyFields?: string[];
  hasUpdatedAt?: boolean;
};

export const MASTER_DATA_ENTITIES = [
  {
    key: "currencies",
    label: "Monedas",
    singularLabel: "Moneda",
    description: "Códigos y símbolos disponibles para importes y reportes.",
    tableName: "Currency",
    orderBy: "code",
    displayField: "code",
    hasUpdatedAt: true,
    fields: [
      { name: "code", label: "Código", type: "text", required: true, placeholder: "ARS" },
      { name: "name", label: "Nombre", type: "text", required: true, placeholder: "Peso argentino" },
      { name: "symbol", label: "Símbolo", type: "text", placeholder: "$" },
      { name: "enabled", label: "Habilitada", type: "boolean", defaultValue: true },
    ],
  },
  {
    key: "banks",
    label: "Bancos",
    singularLabel: "Banco",
    description: "Bancos usados en tarjetas, resúmenes e importaciones.",
    tableName: "Bank",
    orderBy: "name",
    displayField: "name",
    fields: [
      { name: "name", label: "Nombre", type: "text", required: true, placeholder: "BBVA" },
    ],
  },
  {
    key: "categories",
    label: "Categorías",
    singularLabel: "Categoría",
    description: "Clasificación de movimientos manuales, importados y recurrentes.",
    tableName: "Category",
    orderBy: "name",
    displayField: "name",
    fields: [
      { name: "name", label: "Nombre", type: "text", required: true, placeholder: "Supermercado" },
      { name: "icon", label: "Ícono", type: "icon", placeholder: "shopping-cart" },
      { name: "color", label: "Color del ícono", type: "color" },
    ],
  },
  {
    key: "cards",
    label: "Tarjetas",
    singularLabel: "Tarjeta",
    description: "Tarjetas asociadas a bancos e importación de resúmenes.",
    tableName: "Card",
    orderBy: "createdAt",
    displayField: "lastFour",
    fields: [
      {
        name: "bankId",
        label: "Banco",
        type: "relation",
        required: true,
        relation: { entity: "banks", labelField: "name" },
      },
      { name: "lastFour", label: "Últimos 4", type: "text", required: true, placeholder: "1234" },
      {
        name: "cardNetwork",
        label: "Marca",
        type: "select",
        required: true,
        options: [
          { label: "Visa", value: "Visa" },
          { label: "Mastercard", value: "Mastercard" },
          { label: "American Express", value: "American Express" },
          { label: "Cabal", value: "Cabal" },
          { label: "Otra", value: "Other" },
        ],
      },
      {
        name: "cardType",
        label: "Tipo",
        type: "select",
        required: true,
        options: [
          { label: "Crédito", value: "Credit" },
          { label: "Débito", value: "Debit" },
        ],
      },
      { name: "holderName", label: "Titular", type: "text", required: true },
      { name: "accountNumber", label: "Cuenta", type: "text" },
    ],
  },
] as const satisfies MasterDataEntity[];

export type MasterDataEntityKey = (typeof MASTER_DATA_ENTITIES)[number]["key"];

export function getMasterDataEntity(key: string) {
  return MASTER_DATA_ENTITIES.find((entity) => entity.key === key) ?? null;
}

export function quoteSqlIdentifier(identifier: string) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) {
    throw new Error(`Identificador SQL inválido: ${identifier}`);
  }
  return `"${identifier}"`;
}
