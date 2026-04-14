import { NextResponse } from 'next/server';
import { MOCK_SOURCES } from '../_mock-data';

export async function GET() {
  return NextResponse.json({ data: MOCK_SOURCES });
}
