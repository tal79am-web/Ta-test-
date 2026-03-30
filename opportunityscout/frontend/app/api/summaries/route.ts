import { NextResponse } from 'next/server';
import { MOCK_SUMMARY, MOCK_OPPORTUNITIES } from '../_mock-data';

export async function GET() {
  const summary = {
    ...MOCK_SUMMARY,
    topOpportunities: MOCK_OPPORTUNITIES.slice(0, 10),
  };
  return NextResponse.json({ data: [summary] });
}
