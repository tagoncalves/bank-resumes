import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: {
      OR: [
        { aiBlockLevel: { gt: 0 } },
        { aiBlockedUntil: { not: null } },
      ],
    },
  });

  console.log(`Found ${users.length} users with existing ban state.`);

  let created = 0;
  for (const user of users) {
    const existing = await prisma.aiBan.findFirst({
      where: { userId: user.id, status: "ACTIVE" },
    });
    if (existing) {
      console.log(`  Skipping ${user.username} — already has AiBan ${existing.id}`);
      continue;
    }

    const expiresAt = user.aiBlockedUntil;

    await prisma.aiBan.create({
      data: {
        userId: user.id,
        level: Math.max(user.aiBlockLevel, 1),
        status: "ACTIVE",
        reason: "Baneo migrado del estado de usuario anterior",
        expiresAt: expiresAt ?? undefined,
      },
    });
    created++;
    console.log(`  Created AiBan for ${user.username} (level=${user.aiBlockLevel})`);
  }

  console.log(`Done. Created ${created} AiBan records.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
