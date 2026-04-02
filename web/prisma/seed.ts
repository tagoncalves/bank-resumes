import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const CATEGORIES = [
  { name: "Alimentación",    icon: "🍔", color: "#F97316" },
  { name: "Supermercado",    icon: "🛒", color: "#22C55E" },
  { name: "Combustible",     icon: "⛽", color: "#EAB308" },
  { name: "Entretenimiento", icon: "🎬", color: "#8B5CF6" },
  { name: "Tecnología",      icon: "💻", color: "#3B82F6" },
  { name: "Salud",           icon: "💊", color: "#EC4899" },
  { name: "Ropa/Moda",       icon: "👗", color: "#F43F5E" },
  { name: "Delivery",        icon: "🛵", color: "#F59E0B" },
  { name: "Viajes",          icon: "✈️", color: "#06B6D4" },
  { name: "Transporte",      icon: "🚌", color: "#64748B" },
  { name: "Suscripciones",   icon: "📱", color: "#A855F7" },
  { name: "Otros",           icon: "📦", color: "#94A3B8" },
];

async function main() {
  console.log("Seeding categories...");
  for (const cat of CATEGORIES) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
  }
  console.log("Done.");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
