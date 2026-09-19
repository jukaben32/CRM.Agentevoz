import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth/session";

export async function POST(req: NextRequest) {
  await destroySession();
  const url = new URL("/login", req.url);
  return NextResponse.redirect(url, 303);
}
