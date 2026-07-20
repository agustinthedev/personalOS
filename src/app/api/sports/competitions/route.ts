import { NextResponse } from "next/server";
import { getSportsData } from "@/features/sports/data";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await getSportsData();
    return NextResponse.json(
      { competitions: data.competitions, sync: data.sync },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  } catch (error) {
    console.error("Sports competitions read failed", error);
    return NextResponse.json(
      { message: "Could not read sports competitions." },
      { status: 500 },
    );
  }
}

