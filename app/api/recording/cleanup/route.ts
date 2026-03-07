import { S3Client, ListMultipartUploadsCommand, AbortMultipartUploadCommand } from "@aws-sdk/client-s3";
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
 * One-time cleanup: abort all orphaned multipart uploads in the recordings bucket.
 * GET /api/recording/cleanup — lists orphaned uploads (dry run)
 * DELETE /api/recording/cleanup — aborts all orphaned uploads
 */
export async function GET() {
    try {
        const uploads = await listOrphanedUploads();
        return NextResponse.json({
            message: `Found ${uploads.length} orphaned multipart uploads`,
            uploads: uploads.map(u => ({
                key: u.Key,
                uploadId: u.UploadId,
                initiated: u.Initiated,
            })),
        });
    } catch (error) {
        console.error("[Cleanup] Error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

export async function DELETE() {
    try {
        const uploads = await listOrphanedUploads();

        if (uploads.length === 0) {
            return NextResponse.json({ message: "No orphaned uploads found" });
        }

        const results: { key: string; status: string }[] = [];

        for (const upload of uploads) {
            try {
                await r2.send(new AbortMultipartUploadCommand({
                    Bucket: process.env.R2_BUCKET_NAME,
                    Key: upload.Key!,
                    UploadId: upload.UploadId!,
                }));
                results.push({ key: upload.Key!, status: "aborted" });
                console.log(`[Cleanup] Aborted: ${upload.Key}`);
            } catch (e) {
                results.push({ key: upload.Key!, status: `failed: ${e}` });
                console.error(`[Cleanup] Failed to abort ${upload.Key}:`, e);
            }
        }

        return NextResponse.json({
            message: `Processed ${results.length} orphaned uploads`,
            results,
        });
    } catch (error) {
        console.error("[Cleanup] Error:", error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}

async function listOrphanedUploads() {
    const allUploads: any[] = [];
    let keyMarker: string | undefined;
    let uploadIdMarker: string | undefined;

    do {
        const resp = await r2.send(new ListMultipartUploadsCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            KeyMarker: keyMarker,
            UploadIdMarker: uploadIdMarker,
        }));

        if (resp.Uploads) {
            allUploads.push(...resp.Uploads);
        }

        if (resp.IsTruncated) {
            keyMarker = resp.NextKeyMarker;
            uploadIdMarker = resp.NextUploadIdMarker;
        } else {
            break;
        }
    } while (true);

    return allUploads;
}
