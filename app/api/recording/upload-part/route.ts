import { S3Client, UploadPartCommand } from "@aws-sdk/client-s3";
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
        const formData = await request.formData();
        const chunk = formData.get("chunk") as File;
        const uploadId = formData.get("uploadId") as string;
        const key = formData.get("key") as string;
        const partNumber = parseInt(formData.get("partNumber") as string, 10);

        if (!chunk || !uploadId || !key || !partNumber) {
            return NextResponse.json(
                { error: "chunk, uploadId, key, and partNumber are required" },
                { status: 400 }
            );
        }

        console.log(`[Recording/Part] Uploading part ${partNumber} for ${key} (${chunk.size} bytes)`);

        const arrayBuffer = await chunk.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const command = new UploadPartCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
            Body: buffer,
        });

        const response = await r2.send(command);

        console.log(`[Recording/Part] Part ${partNumber} uploaded, ETag: ${response.ETag}`);

        return NextResponse.json({
            partNumber,
            eTag: response.ETag,
        });
    } catch (error) {
        console.error("[Recording/Part] Error:", error);
        return NextResponse.json({ error: "Failed to upload part", details: String(error) }, { status: 500 });
    }
}
