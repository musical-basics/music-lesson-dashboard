import { NextResponse } from "next/server";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { studentId, recordingUrl, filename } = body;

        // The URL of your OTHER app (The Piano Studio Portal)
        const PIANO_STUDIO_URL = process.env.PIANO_STUDIO_URL;
        const PIANO_STUDIO_SECRET = process.env.PIANO_STUDIO_SECRET; // Shared secret for security

        if (!PIANO_STUDIO_URL) {
            console.error("PIANO_STUDIO_URL not set");
            return NextResponse.json({ ignored: true });
        }

        // Send the webhook to the Piano Studio
        const response = await fetch(`${PIANO_STUDIO_URL}/api/webhooks/lesson-recording`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-webhook-secret': PIANO_STUDIO_SECRET || '',
            },
            body: JSON.stringify({
                studentId,
                recordingUrl,
                recordedAt: new Date().toISOString(),
                filename
            })
        });

        if (!response.ok) {
            console.error("Piano Studio rejected webhook:", await response.text());
            return NextResponse.json({ error: "Failed to notify studio" }, { status: 500 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Integration Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
