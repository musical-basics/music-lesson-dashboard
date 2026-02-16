import { S3Client, UploadPartCommand, CompleteMultipartUploadCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const r2 = new S3Client({
    region: "auto",
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
});

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
    try {
        const contentType = request.headers.get("content-type") || "";

        let uploadId: string;
        let key: string;
        let parts: { PartNumber: number; ETag: string }[];
        let studentId: string;
        let teacherId: string;
        let finalChunk: File | null = null;
        let totalSize: number = 0;

        if (contentType.includes("multipart/form-data")) {
            // FormData format (used by both normal finalize and sendBeacon)
            const formData = await request.formData();
            uploadId = formData.get("uploadId") as string;
            key = formData.get("key") as string;
            studentId = formData.get("studentId") as string || "guest";
            teacherId = formData.get("teacherId") as string || "teacher-1";
            totalSize = parseInt(formData.get("totalSize") as string || "0", 10);

            // Parse parts JSON
            const partsJson = formData.get("parts") as string;
            parts = partsJson ? JSON.parse(partsJson) : [];

            // Check for a final chunk to upload
            finalChunk = formData.get("finalChunk") as File | null;
        } else {
            // JSON format
            const body = await request.json();
            uploadId = body.uploadId;
            key = body.key;
            parts = body.parts || [];
            studentId = body.studentId || "guest";
            teacherId = body.teacherId || "teacher-1";
            totalSize = body.totalSize || 0;
        }

        if (!uploadId || !key) {
            return NextResponse.json({ error: "uploadId and key are required" }, { status: 400 });
        }

        console.log(`[Recording/Finalize] Finalizing ${key} with ${parts.length} parts`);

        // Upload final chunk if present
        if (finalChunk && finalChunk.size > 0) {
            const nextPartNumber = parts.length > 0
                ? Math.max(...parts.map(p => p.PartNumber)) + 1
                : 1;

            console.log(`[Recording/Finalize] Uploading final part ${nextPartNumber} (${finalChunk.size} bytes)`);

            const arrayBuffer = await finalChunk.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const uploadPartResponse = await r2.send(new UploadPartCommand({
                Bucket: process.env.R2_BUCKET_NAME,
                Key: key,
                UploadId: uploadId,
                PartNumber: nextPartNumber,
                Body: buffer,
            }));

            parts.push({
                PartNumber: nextPartNumber,
                ETag: uploadPartResponse.ETag!,
            });

            totalSize += finalChunk.size;
        }

        if (parts.length === 0) {
            console.log("[Recording/Finalize] No parts to finalize, aborting");
            return NextResponse.json({ error: "No parts uploaded" }, { status: 400 });
        }

        // Sort parts by PartNumber
        parts.sort((a, b) => a.PartNumber - b.PartNumber);

        // Complete the multipart upload
        const completeResponse = await r2.send(new CompleteMultipartUploadCommand({
            Bucket: process.env.R2_BUCKET_NAME,
            Key: key,
            UploadId: uploadId,
            MultipartUpload: {
                Parts: parts.map(p => ({
                    PartNumber: p.PartNumber,
                    ETag: p.ETag,
                })),
            },
        }));

        const publicUrl = `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL}/${key}`;
        console.log(`[Recording/Finalize] Complete! URL: ${publicUrl}`);

        // Save to classroom_recordings
        const { error: dbError } = await supabase.from("classroom_recordings").insert({
            student_id: studentId,
            teacher_id: teacherId,
            filename: `Lesson - ${new Date().toLocaleDateString()}`,
            url: publicUrl,
            size_bytes: totalSize,
        });

        if (dbError) {
            console.error("[Recording/Finalize] DB Error:", dbError);
        }

        // Notify Piano Studio (best effort)
        try {
            await fetch(`${process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000'}/api/integrations/piano-studio`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    studentId,
                    recordingUrl: publicUrl,
                    filename: key,
                }),
            });
        } catch (e) {
            console.error("[Recording/Finalize] Piano Studio notification failed:", e);
        }

        return NextResponse.json({ url: publicUrl, success: true });
    } catch (error) {
        console.error("[Recording/Finalize] Error:", error);
        return NextResponse.json({ error: "Failed to finalize recording", details: String(error) }, { status: 500 });
    }
}
