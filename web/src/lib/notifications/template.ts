export function renderTemplate(template: string, payload: Record<string, unknown>) {
  return template.replace(/{{\s*([a-zA-Z0-9_.]+)\s*}}/g, (_, key: string) => {
    const value = key.split(".").reduce<unknown>((acc, part) => {
      if (acc && typeof acc === "object" && part in acc) {
        return (acc as Record<string, unknown>)[part];
      }
      return undefined;
    }, payload);

    if (value == null) return "";
    if (value instanceof Date) return value.toLocaleDateString("es-AR");
    return String(value);
  });
}

export function formatMoney(amount: number, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
  }).format(amount);
}

export function defaultTemplates() {
  return {
    RECURRENT_TRANSACTION_REMINDER: {
      subject: "Confirmar movimiento recurrente: {{merchantName}}",
      bodyFormat: "HTML",
      body: `<h2>Confirmar movimiento recurrente</h2>
<p>Se acerca el movimiento <strong>{{merchantName}}</strong>.</p>
<p>Monto: <strong>{{amount}}</strong></p>
<p>Fecha esperada: {{dueDate}}</p>
<p><a href="{{confirmUrl}}">Confirmar</a> · <a href="{{rejectUrl}}">Rechazar</a></p>`,
    },
    RECURRENT_TRANSACTION_CREATED: {
      subject: "Movimiento recurrente creado: {{merchantName}}",
      bodyFormat: "HTML",
      body: `<h2>Movimiento recurrente creado</h2>
<p>Se registró <strong>{{merchantName}}</strong> por <strong>{{amount}}</strong>.</p>
<p>Fecha: {{dueDate}}</p>`,
    },
  };
}
