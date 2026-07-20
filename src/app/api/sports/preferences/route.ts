import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateSportsPreferences } from "@/features/sports/data";

const sportSchema = z.enum(["football", "basketball", "padel", "formula1"]);
const bodySchema = z.object({
  timezone: z.string().min(1).max(100).optional(),
  preferredSports: z.array(sportSchema).max(20).optional(),
  preferredCompetitionIds: z.array(z.string().max(100)).max(500).optional(),
  defaultCompetitionMode: z.enum(["preferred", "all"]).optional(),
  lastSelectedSport: sportSchema.optional(),
  lastSelectedCompetitionIds: z.array(z.string().max(100)).max(100).optional(),
});

export async function PUT(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json());
    if (body.timezone) {
      new Intl.DateTimeFormat("en", { timeZone: body.timezone }).format();
    }
    return NextResponse.json(await updateSportsPreferences(body), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Sports preferences update failed", error);
    return NextResponse.json({ message: "Invalid sports preferences." }, { status: 400 });
  }
}
