import { NextRequest, NextResponse } from 'next/server';
import { MOCK_SETTINGS } from '../_mock-data';

let settings = { ...MOCK_SETTINGS };

export async function GET() {
  return NextResponse.json({ data: settings });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  settings = { ...settings, ...body };
  return NextResponse.json({ data: settings });
}
