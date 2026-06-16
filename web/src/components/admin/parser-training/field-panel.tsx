"use client"

const REQUIRED_FIELDS = [
  { key: "employer_name", label: "Empleador" },
  { key: "employee_name", label: "Empleado" },
  { key: "period_label", label: "Período" },
  { key: "pay_date", label: "Fecha de pago" },
  { key: "net_amount_ars", label: "Neto ($)" },
]

const OPTIONAL_FIELDS = [
  { key: "gross_amount_ars", label: "Bruto ($)" },
  { key: "bank_name", label: "Banco" },
]

interface AnchorEntry {
  id?: string
  fieldName: string
  confirmedText?: string | null
  updatedAt?: string
}

interface Props {
  selectedField: string | null
  onSelectField: (key: string) => void
  anchors: AnchorEntry[]
  currentRawText: string | null
  confirmedText: string
  onConfirmedTextChange: (text: string) => void
  onSave: () => void
  saving: boolean
  extractingSelection?: boolean
}

export default function FieldPanel({
  selectedField,
  onSelectField,
  anchors,
  currentRawText,
  confirmedText,
  onConfirmedTextChange,
  onSave,
  saving,
  extractingSelection = false,
}: Props) {
  const anchorMap = new Map(anchors.map((a) => [a.fieldName, a]))

  return (
    <div className="flex flex-col gap-4 p-4 border rounded bg-white">
      <h3 className="font-semibold text-lg">Campos Requeridos</h3>
      <div className="flex flex-col gap-1">
        {REQUIRED_FIELDS.map((f) => {
          const anchor = anchorMap.get(f.key)
          const isSelected = selectedField === f.key
          return (
            <button
              key={f.key}
              onClick={() => onSelectField(f.key)}
              className={`text-left px-3 py-2 rounded border text-sm transition-colors ${
                isSelected
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                  : anchor
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{f.label}</span>
                {anchor ? (
                  <span className="text-emerald-600 text-xs">✔ Listo</span>
                ) : (
                  <span className="text-gray-400 text-xs">—</span>
                )}
              </div>
              {anchor?.confirmedText && (
                <div className="text-gray-500 text-xs mt-1 truncate">
                  {anchor.confirmedText}
                </div>
              )}
            </button>
          )
        })}
      </div>

      <h3 className="font-semibold text-lg">Opcionales</h3>
      <div className="flex flex-col gap-1">
        {OPTIONAL_FIELDS.map((f) => {
          const anchor = anchorMap.get(f.key)
          const isSelected = selectedField === f.key
          return (
            <button
              key={f.key}
              onClick={() => onSelectField(f.key)}
              className={`text-left px-3 py-2 rounded border text-sm transition-colors ${
                isSelected
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                  : anchor
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{f.label}</span>
                {anchor ? (
                  <span className="text-emerald-600 text-xs">✔</span>
                ) : (
                  <span className="text-gray-400 text-xs">—</span>
                )}
              </div>
              {anchor?.confirmedText && (
                <div className="text-gray-500 text-xs mt-1 truncate">
                  {anchor.confirmedText}
                </div>
              )}
            </button>
          )
        })}
      </div>

      {selectedField && (
        <div className="mt-4 p-3 border rounded bg-gray-50">
          <h4 className="font-semibold text-sm mb-2">
            {REQUIRED_FIELDS.find((f) => f.key === selectedField)?.label ??
              OPTIONAL_FIELDS.find((f) => f.key === selectedField)?.label ??
              selectedField}
          </h4>

          <div className="mb-2">
            <label className="text-xs text-gray-500">Texto extraído</label>
            <div className="text-sm bg-white border rounded p-2 min-h-[2rem]">
              {extractingSelection ? (
                <span className="text-gray-400">Extrayendo texto de la región...</span>
              ) : currentRawText ? (
                currentRawText
              ) : (
                <span className="text-gray-400">Seleccioná un área en el PDF</span>
              )}
            </div>
            {!extractingSelection && !currentRawText && (
              <p className="mt-1 text-xs text-amber-700">
                Si el PDF no expone texto util, igual podés confirmar el valor manualmente.
              </p>
            )}
          </div>

          <div className="mb-2">
            <label className="text-xs text-gray-500">Valor confirmado</label>
            <input
              type="text"
              value={confirmedText}
              onChange={(e) => onConfirmedTextChange(e.target.value)}
              placeholder="Ingresá el valor manualmente"
              className="w-full border rounded px-2 py-1 text-sm"
            />
          </div>

          <button
            onClick={onSave}
            disabled={saving || !confirmedText.trim()}
            className="w-full px-3 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? "Guardando..." : "Guardar Ancla"}
          </button>
        </div>
      )}
    </div>
  )
}
