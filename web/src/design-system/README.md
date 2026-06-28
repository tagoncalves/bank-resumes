# Warm Finance Design System

## Relevamiento

- La app mezclaba `zinc`, `indigo`, `red`, `emerald`, `amber`, `sky`, `purple` y `white` directo en páginas y componentes.
- Los patrones repetidos principales eran inputs, botones, badges/chips, tablas, modales y filter pills.
- El color `indigo` funcionaba como primary, focus y AI a la vez; ahora `primary` queda para finanzas y `ai` para chat/asistente.

## Estructura

- `src/design-system/tokens.ts`: tokens Warm Finance para documentación, charts y Storybook.
- `src/design-system/components/*`: componentes primitivos normalizados.
- `src/design-system/stories/*`: playground y stories del sistema.
- `src/components/ui/*`: wrappers compatibles para imports existentes.

## Regla de uso

- Usar `bg-surface`, `bg-surface-alt`, `text-foreground`, `text-muted`, `border-border`, `text-primary`, `text-income`, `text-expense`, `text-saving`, `text-project`, `text-warning` y `text-ai` antes que colores Tailwind hardcodeados.
- Usar `Button`, `Badge`, `Card`, `Input`, `Textarea`, `FilterPill` y `Table` antes que repetir clases.
