import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";

const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

export async function POST(request: Request) {
    try {
        const { filename, contentType } = await request.json();

        // Sanitize the Content-Type (Fixes the 403 Mismatch)
        // If browser sends "video/webm;codecs=vp8", we just want "video/webm"
        const cleanType = contentType.split(';')[0];

        console.log("[Upload API] Signing for:", filename, "Type:", cleanType);

        const command = new PutObjectCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: filename,
            ContentType: cleanType, // Sign with the clean type
        });

        const signedUrl = await getSignedUrl(r2, command, { expiresIn: 3600 });

        console.log("[Upload API] Signed URL generated successfully");

        // Return URL and the clean type so frontend knows what header to send
        return NextResponse.json({ url: signedUrl, cleanType });
    } catch (error) {
        console.error("[Upload API] R2 Signing Error:", error);
        return NextResponse.json({ error: "Failed to sign URL", details: String(error) }, { status: 500 });
    }
}
