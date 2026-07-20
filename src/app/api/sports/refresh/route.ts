import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseRefreshScope, refreshSports } from "@/features/sports/refresh";

const bodySchema = z.object({
  scope: z.string().max(120).default("all-supported"),
  force: z.boolean().optional().default(false),
});

export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json());
    const scope = parseRefreshScope(body.scope);
    if (!scope) {
      return NextResponse.json({ message: "Invalid refresh scope." }, { status: 400 });
    }
    const result = await refreshSports(scope, body.force);
    return NextResponse.json(result, {
      status: result.status === "failure" ? 502 : 200,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    console.error("Sports refresh request failed", error);
    return NextResponse.json({ message: "Invalid refresh request." }, { status: 400 });
  }
}

