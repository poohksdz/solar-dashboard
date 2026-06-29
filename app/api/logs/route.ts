import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? parseInt(limitParam, 10) : 500;
    
    // We sort by timestamp ASC, but fetch limited.
    // To get the latest N and return them in ASC order, we would order by desc, take limit, then reverse.
    const logs = await prisma.sessionLog.findMany({
      orderBy: { timestamp: 'desc' },
      take: isNaN(limit) ? 500 : limit,
    });
    
    // Reverse to maintain chronological order if needed, but summary page sorts it.
    logs.reverse();
    
    return NextResponse.json({ logs, total: logs.length });
  } catch (error) {
    console.error('Failed to fetch logs:', error);
    return NextResponse.json({ success: false, error: 'Database connection failed. Ensure DATABASE_URL is set.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    const entry = await prisma.sessionLog.create({
      data: {
        simTime: body.simTime ?? 0,
        simTimeLabel: body.simTimeLabel ?? '00:00',
        batteryLevel: body.batteryLevel ?? 0,
        totalSaved: body.totalSaved ?? 0,
        weatherMode: body.weatherMode ?? 'NORMAL',
        solarPower: body.solarPower ?? 0,
        homeConsumption: body.homeConsumption ?? 0,
        gridImport: body.gridImport ?? 0,
        appliances: body.appliances ?? [],
        aiAutoMode: body.aiAutoMode ?? false,
        aiActionsCount: body.aiActionsCount ?? 0,
        houseId: body.houseId ?? 'default-house-1',
      }
    });
    
    // Optional: Implement cleanup of older logs here if needed, 
    // e.g., deleting where id NOT IN (SELECT id ORDER BY timestamp DESC LIMIT 500)
    
    return NextResponse.json({ success: true, id: entry.id }, { status: 201 });
  } catch (error) {
    console.error('Failed to create log:', error);
    return NextResponse.json({ success: false, error: 'Failed to write to database. Ensure DATABASE_URL is set.' }, { status: 400 });
  }
}
