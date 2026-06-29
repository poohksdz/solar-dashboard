import { NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET() {
  try {
    const houses = await prisma.house.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ houses });
  } catch (error) {
    console.error('Failed to fetch houses:', error);
    return NextResponse.json({ error: 'Failed to fetch houses' }, { status: 500 });
  }
}
