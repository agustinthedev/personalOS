import { NextResponse } from "next/server";
import { getSportsData } from "@/features/sports/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getSportsData(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (error) {
    console.error("Sports events read failed", error);
    return NextResponse.json(
      { message: "Could not read sports schedules." },
      { status: 500 },
    );
  }
}

