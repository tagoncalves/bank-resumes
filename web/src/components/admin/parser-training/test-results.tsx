"use client"

export interface TestResultItem {
  fieldName: string
  expected: string | null
  extracted: string | null
  passed: boolean
  normalizedExpected?: string | null
  normalizedExtracted?: string | null
}

interface Props {
  results: TestResultItem[]
  allPassed: boolean
  onApprove: () => void
  approving: boolean
}

const FIELD_LABELS: Record<string, string> = {
  employer_name: "Empleador",
  employee_name: "Empleado",
  period_label: "Período",
  pay_date: "Fecha de pago",
  net_amount_ars: "Neto ($)",
  gross_amount_ars: "Bruto ($)",
  bank_name: "Banco",
}

export default function TestResults({ results, allPassed, onApprove, approving }: Props) {
  if (results.length === 0) return null

  return (
    <div className="border rounded bg-white p-4">
      <h3 className="font-semibold text-lg mb-3">Resultados de la Prueba</h3>

      <div className="flex flex-col gap-2 mb-4">
        {results.map((r) => (
          <div
            key={r.fieldName}
            className={`flex items-center justify-between p-2 rounded text-sm border ${
              r.passed ? "border-emerald-200 bg-emerald-50" : "border-red-200 bg-red-50"
            }`}
          >
            <div className="flex-1">
              <div className="font-medium">
                {FIELD_LABELS[r.fieldName] ?? r.fieldName}
              </div>
              <div className="text-xs text-gray-500">
                Esperado: <span className="font-mono">{r.expected ?? "—"}</span>
              </div>
              <div className="text-xs text-gray-500">
                Extraído:{" "}
                <span className="font-mono">{r.extracted ?? <span className="text-red-500">—</span>}</span>
              </div>
            </div>
            <div className="text-lg ml-2">
              {r.passed ? <span className="text-emerald-600">✔</span> : <span className="text-red-500">✘</span>}
            </div>
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm">
          {allPassed ? (
            <span className="text-emerald-700 font-medium">Todos los campos coinciden</span>
          ) : (
            <span className="text-red-700 font-medium">Hay campos que no coinciden</span>
          )}
        </div>

        <button
          onClick={onApprove}
          disabled={!allPassed || approving}
          className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          {approving ? "Aprobando..." : "Aprobar Parser"}
        </button>
      </div>
    </div>
  )
}
