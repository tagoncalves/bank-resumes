const CATEGORY_RULES: Array<{ pattern: RegExp; category: string }> = [
  // Alimentación (fast food)
  { pattern: /mcdonalds|mcdonald|burger\s*king|mostaza|wendy|subway|kentucky|kfc|pizza|empanada/i, category: "Alimentación" },
  // Delivery
  { pattern: /pedidos\s*ya|rappi|uber\s*eats|glovo|ifood|dlo\s*pedidos/i, category: "Delivery" },
  // Supermercado
  { pattern: /carrefour|jumbo|coto\b|walmart|dia\b|vea\b|disco\b|norte\b|la\s*anonima|changomas|mayorista/i, category: "Supermercado" },
  // Combustible
  { pattern: /shell|ypf|axion|puma\s*energy|petrobras|eg3|oil\s*combustible/i, category: "Combustible" },
  // Suscripciones / streaming
  { pattern: /netflix|spotify|disney|hbo|star\+|amazon\s*prime|youtube\s*premium|flow\b|telecentro|directv|apple\.com|chatgpt|openai/i, category: "Suscripciones" },
  // Entretenimiento
  { pattern: /cine|hoyts|cinemark|showcase|movistar\s*arena|luna\s*park|ticketek|eventbrite/i, category: "Entretenimiento" },
  // Tecnología
  { pattern: /mercado\s*libre|mercadolibre|amazon(?!\s*prime)|google\s*(play|one|storage)|microsoft|adobe|codehouse|cetrogar/i, category: "Tecnología" },
  // Salud
  { pattern: /farmaci|farmacity|doctor|medico|clinica|hospital|laboratorio|osde|swiss\s*medical|galeno|ipharm/i, category: "Salud" },
  // Ropa / Moda
  { pattern: /zara|h&m|adidas|nike|lacoste|falabella|paris|saga|under\s*armour|rouge|palermo\s*soho/i, category: "Ropa/Moda" },
  // Viajes
  { pattern: /aerol[ií]neas|lan\b|latam|flybondi|jetsmart|hotel|booking|airbnb|despegar|decolar/i, category: "Viajes" },
  // Transporte
  { pattern: /subte|metrobus|sube\b|taxi|uber\b|cabify|remis|tren\s*(de\s*la\s*costa|sarmiento|roca)/i, category: "Transporte" },
];

export function categorizeTransaction(merchantName: string): string {
  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(merchantName)) return rule.category;
  }
  return "Otros";
}
