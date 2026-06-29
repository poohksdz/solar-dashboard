import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  try {
    const { title, message, color = 16711680 } = await request.json(); // Default to red
    const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

    if (!webhookUrl) {
      return NextResponse.json({ error: 'Discord webhook URL not configured' }, { status: 400 });
    }

    const payload = {
      username: 'Solar Dashboard AI',
      embeds: [
        {
          title,
          description: message,
          color,
          timestamp: new Date().toISOString(),
        }
      ]
    };

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Discord API error: ${res.statusText}`);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json({ error: 'Failed to send notification' }, { status: 500 });
  }
}
