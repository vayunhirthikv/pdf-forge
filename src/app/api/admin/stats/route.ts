import { NextResponse } from "next/server";
import { jobStats } from "@/lib/server/history";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(await jobStats());
}
