import { NextRequest, NextResponse } from 'next/server';
import { MOCK_OPPORTUNITIES } from '../_mock-data';

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const limit = parseInt(searchParams.get('limit') ?? '10');
  const page = parseInt(searchParams.get('page') ?? '1');
  const sortBy = searchParams.get('sortBy') ?? 'composite';
  const order = searchParams.get('order') ?? 'desc';
  const category = searchParams.get('category');
  const source = searchParams.get('source');
  const search = searchParams.get('search')?.toLowerCase();

  let opps = [...MOCK_OPPORTUNITIES];

  if (category) opps = opps.filter(o => o.category === category);
  if (source) opps = opps.filter(o => o.sources.includes(source));
  if (search) opps = opps.filter(o =>
    o.title.toLowerCase().includes(search) ||
    o.problemStatement.toLowerCase().includes(search)
  );

  opps.sort((a, b) => {
    let aVal = 0, bVal = 0;
    if (sortBy === 'composite') { aVal = a.score.composite; bVal = b.score.composite; }
    else if (sortBy === 'volume') { aVal = a.score.volume; bVal = b.score.volume; }
    else if (sortBy === 'signals') { aVal = a.rawSignalCount; bVal = b.rawSignalCount; }
    else if (sortBy === 'date') {
      aVal = new Date(a.firstSeenAt).getTime();
      bVal = new Date(b.firstSeenAt).getTime();
    }
    return order === 'desc' ? bVal - aVal : aVal - bVal;
  });

  const total = opps.length;
  const paged = opps.slice((page - 1) * limit, page * limit);

  return NextResponse.json({
    data: paged,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}
