import { NextRequest, NextResponse } from 'next/server';
import { MOCK_OPPORTUNITIES } from '../../_mock-data';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const opp = MOCK_OPPORTUNITIES.find(o => o.id === params.id);
  if (!opp) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ data: opp });
}
