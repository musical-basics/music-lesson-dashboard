import { S3Client, CreateMultipartUploadCommand } from "@aws-sdk/client-s3";
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
        const { filename } = await request.json();

        if (!filename) {
            return NextResponse.json({ error: "filename is required" }, { status: 400 });
        }

        console.log("[Recording/Start] Initiating multipart upload for:", filename);

        const command = new CreateMultipartUploadCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: filename,
            ContentType: "video/webm",
        });

        const response = await r2.send(command);

        console.log("[Recording/Start] Upload ID:", response.UploadId);

        return NextResponse.json({
            uploadId: response.UploadId,
            key: filename,
        });
    } catch (error) {
        console.error("[Recording/Start] Error:", error);
        return NextResponse.json({ error: "Failed to start upload", details: String(error) }, { status: 500 });
    }
}
