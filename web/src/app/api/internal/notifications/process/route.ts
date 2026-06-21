import { NextResponse } from "next/server";
import { processNotifications } from "@/lib/notifications/engine";

export async function POST() {
  const result = await processNotifications();
  return NextResponse.json(result);
}
