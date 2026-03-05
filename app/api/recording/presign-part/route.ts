import { S3Client, UploadPartCommand } from "@aws-sdk/client-s3";
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

/**
 * Generate a presigned URL for uploading a part directly to R2.
 * The browser will PUT the chunk data directly to this URL,
 * completely bypassing Next.js/Vercel body size limits.
 */
export async function POST(request: Request) {
    try {
        const { uploadId, key, partNumber } = await request.json();

        if (!uploadId || !key || !partNumber) {
            return NextResponse.json(
                { error: "uploadId, key, and partNumber are required" },
                { status: 400 }
            );
        }

        const command = new UploadPartCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
        });

        // Presigned URL valid for 30 minutes
        const presignedUrl = await getSignedUrl(r2, command, { expiresIn: 1800 });

        return NextResponse.json({ presignedUrl, partNumber });
    } catch (error) {
        console.error("[Recording/Presign] Error:", error);
        return NextResponse.json(
            { error: "Failed to generate presigned URL", details: String(error) },
            { status: 500 }
        );
    }
}
