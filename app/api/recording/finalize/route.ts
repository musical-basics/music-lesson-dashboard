import { S3Client, UploadPartCommand, CompleteMultipartUploadCommand, ListPartsCommand } from "@aws-sdk/client-s3";
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

function getMp4Key(sourceKey: string) {
    return sourceKey.toLowerCase().endsWith(".webm")
        ? sourceKey.replace(/\.webm$/i, ".mp4")
        : `${sourceKey}.mp4`;
}

function getPublicUrl(key: string) {
    return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL?.replace(/\/$/, "")}/${key}`;
}

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

        console.log(`[Recording/Finalize] Finalizing ${key} with ${parts.length} client-provided parts`);

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

        // If no parts with ETags from client (presigned URL flow),
        // fetch all parts from R2 using ListParts
        const hasValidETags = parts.length > 0 && parts.every(p => p.ETag);
        if (!hasValidETags) {
            console.log(`[Recording/Finalize] No valid client ETags, fetching parts from R2...`);
            const allParts: { PartNumber: number; ETag: string }[] = [];
            let partMarker: string | undefined;

            // ListParts is paginated, loop until we have all parts
            do {
                const listResp = await r2.send(new ListPartsCommand({
                    Bucket: process.env.R2_BUCKET_NAME,
                    Key: key,
                    UploadId: uploadId,
                    PartNumberMarker: partMarker,
                }));

                if (listResp.Parts) {
                    for (const part of listResp.Parts) {
                        if (part.PartNumber && part.ETag) {
                            allParts.push({ PartNumber: part.PartNumber, ETag: part.ETag });
                        }
                    }
                }

                partMarker = listResp.IsTruncated ? String(listResp.NextPartNumberMarker) : undefined;
            } while (partMarker);

            parts = allParts;
            console.log(`[Recording/Finalize] Found ${parts.length} parts from R2`);
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

        const publicUrl = getPublicUrl(key);
        console.log(`[Recording/Finalize] Complete! URL: ${publicUrl}`);

        // Save to classroom_recordings
        const { data: recording, error: dbError } = await supabase.from("classroom_recordings").insert({
            student_id: studentId,
            teacher_id: teacherId,
            filename: `Lesson - ${new Date().toLocaleDateString()}`,
            url: publicUrl,
            size_bytes: totalSize,
        }).select("id").single();

        if (dbError) {
            console.error("[Recording/Finalize] DB Error:", dbError);
        }

        let conversionJobQueued = false;
        if (key.toLowerCase().endsWith(".webm")) {
            const targetKey = getMp4Key(key);
            const targetUrl = getPublicUrl(targetKey);

            const { error: jobError } = await supabase.from("recording_conversion_jobs").insert({
                recording_id: recording?.id || null,
                source_key: key,
                source_url: publicUrl,
                target_key: targetKey,
                target_url: targetUrl,
                student_id: studentId,
                teacher_id: teacherId,
                status: "pending",
            });

            if (jobError) {
                console.error("[Recording/Finalize] Failed to queue MP4 conversion:", jobError);
            } else {
                conversionJobQueued = true;
                console.log(`[Recording/Finalize] Queued MP4 conversion: ${key} -> ${targetKey}`);
            }
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

        return NextResponse.json({ url: publicUrl, success: true, conversionJobQueued });
    } catch (error) {
        console.error("[Recording/Finalize] Error:", error);
        return NextResponse.json({ error: "Failed to finalize recording", details: String(error) }, { status: 500 });
    }
}
