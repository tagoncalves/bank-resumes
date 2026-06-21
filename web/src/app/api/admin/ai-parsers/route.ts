import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSession, isAdmin } from "@/lib/auth";

async function guardAdmin() {
  const session = await getSession();
  if (!session || !isAdmin(session))
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  return session;
}

export async function GET() {
  const session = await guardAdmin();
  if (session instanceof NextResponse) return session;

  const parsers = await prisma.aiParser.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      reviewedBy: {
        select: { id: true, username: true, displayName: true },
      },
      payslip: {
        select: {
          rawFilename: true,
          employerName: true,
          employeeName: true,
          periodLabel: true,
          payDate: true,
          netAmount: true,
          grossAmount: true,
          processingStatus: true,
          analysisProvider: true,
          analysisConfidence: true,
          analysisNotes: true,
          analysisStructuredJson: true,
          analysisModel: true,
          analysisPromptVersion: true,
        },
      },
      statement: {
        select: {
          rawFilename: true,
          bankName: true,
          processingStatus: true,
          analysisProvider: true,
          analysisConfidence: true,
          analysisNotes: true,
          analysisStructuredJson: true,
          analysisModel: true,
          analysisPromptVersion: true,
          card: {
            select: {
              holderName: true,
              lastFour: true,
              cardNetwork: true,
            },
          },
        },
      },
    },
  });

  return NextResponse.json(parsers);
}

export async function DELETE(request: Request) {
  const session = await guardAdmin();
  if (session instanceof NextResponse) return session;

  const { parserId } = await request.json();
  if (!parserId) return NextResponse.json({ error: "parserId requerido" }, { status: 400 });

  const parser = await prisma.aiParser.findUnique({ where: { id: parserId } });
  if (!parser) return NextResponse.json({ error: "Parser no encontrado" }, { status: 404 });

  await prisma.aiParser.delete({ where: { id: parserId } });

  return NextResponse.json({ success: true });
}

export async function PATCH(request: Request) {
  const session = await guardAdmin();
  if (session instanceof NextResponse) return session;

  const { parserId, status, notes } = await request.json();
  if (!parserId) return NextResponse.json({ error: "parserId requerido" }, { status: 400 });
  if (!["APPROVED", "REJECTED"].includes(status)) {
    return NextResponse.json({ error: 'status debe ser APPROVED o REJECTED' }, { status: 400 });
  }

  const parser = await prisma.aiParser.findUnique({ where: { id: parserId } });
  if (!parser) return NextResponse.json({ error: "Parser no encontrado" }, { status: 404 });

  const updated = await prisma.aiParser.update({
    where: { id: parserId },
    data: {
      status,
      notes: notes ?? parser.notes,
      reviewedById: session.userId,
      reviewedAt: new Date(),
    },
  });

  return NextResponse.json(updated);
}
