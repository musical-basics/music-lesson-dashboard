import { createReadStream, createWriteStream } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { pipeline } from "node:stream/promises";
import { S3Client, GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";

const requiredEnv = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "NEXT_PUBLIC_R2_PUBLIC_URL",
];

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required env var: ${key}`);
  }
}

const pollMs = Number(process.env.RECORDING_CONVERTER_POLL_MS || 5000);
const maxAttempts = Number(process.env.RECORDING_CONVERTER_MAX_ATTEMPTS || 3);
const staleJobMs = Number(process.env.RECORDING_CONVERTER_STALE_MINUTES || 30) * 60 * 1000;
const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

const r2 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

let shouldStop = false;
process.on("SIGINT", () => {
  shouldStop = true;
});
process.on("SIGTERM", () => {
  shouldStop = true;
});

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getPublicUrl(key) {
  return `${process.env.NEXT_PUBLIC_R2_PUBLIC_URL.replace(/\/$/, "")}/${key}`;
}

async function claimNextJob() {
  if (staleJobMs > 0) {
    const staleCutoff = new Date(Date.now() - staleJobMs).toISOString();

    const { error: releaseError } = await supabase
      .from("recording_conversion_jobs")
      .update({
        status: "pending",
        locked_at: null,
        updated_at: new Date().toISOString(),
        error: "Worker lock expired; retrying",
      })
      .eq("status", "processing")
      .lt("attempts", maxAttempts)
      .lt("locked_at", staleCutoff);

    if (releaseError) throw releaseError;

    const { error: failStaleError } = await supabase
      .from("recording_conversion_jobs")
      .update({
        status: "failed",
        locked_at: null,
        updated_at: new Date().toISOString(),
        error: "Worker lock expired after max attempts",
      })
      .eq("status", "processing")
      .gte("attempts", maxAttempts)
      .lt("locked_at", staleCutoff);

    if (failStaleError) throw failStaleError;
  }

  const { data: job, error: selectError } = await supabase
    .from("recording_conversion_jobs")
    .select("*")
    .eq("status", "pending")
    .lt("attempts", maxAttempts)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (selectError) throw selectError;
  if (!job) return null;

  const { data: claimedJob, error: updateError } = await supabase
    .from("recording_conversion_jobs")
    .update({
      status: "processing",
      attempts: (job.attempts || 0) + 1,
      locked_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error: null,
    })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("*")
    .maybeSingle();

  if (updateError) throw updateError;
  return claimedJob;
}

async function writeBodyToFile(body, filePath) {
  if (!body) {
    throw new Error("R2 object response did not include a body");
  }

  if (typeof body.transformToByteArray === "function") {
    const bytes = await body.transformToByteArray();
    await writeFile(filePath, Buffer.from(bytes));
    return;
  }

  await pipeline(body, createWriteStream(filePath));
}

async function runFfmpeg(inputPath, outputPath) {
  const args = [
    "-y",
    "-i",
    inputPath,
    "-map",
    "0:v:0",
    "-map",
    "0:a:0?",
    "-c:v",
    "libx264",
    "-preset",
    process.env.RECORDING_CONVERTER_FFMPEG_PRESET || "veryfast",
    "-crf",
    process.env.RECORDING_CONVERTER_FFMPEG_CRF || "23",
    "-c:a",
    "aac",
    "-b:a",
    process.env.RECORDING_CONVERTER_AUDIO_BITRATE || "128k",
    "-movflags",
    "+faststart",
    outputPath,
  ];

  await new Promise((resolve, reject) => {
    const child = spawn(ffmpegPath, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      process.stdout.write(`[ffmpeg] ${chunk}`);
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
      process.stderr.write(`[ffmpeg] ${chunk}`);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-2000)}`));
      }
    });
  });
}

async function notifyPianoStudio(job, recordingUrl) {
  if (process.env.NOTIFY_PIANO_STUDIO_ON_MP4 !== "true") return;
  if (!process.env.PIANO_STUDIO_URL) return;

  const response = await fetch(`${process.env.PIANO_STUDIO_URL}/api/webhooks/lesson-recording`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-webhook-secret": process.env.PIANO_STUDIO_SECRET || "",
    },
    body: JSON.stringify({
      studentId: job.student_id,
      recordingUrl,
      recordedAt: new Date().toISOString(),
      filename: job.target_key,
    }),
  });

  if (!response.ok) {
    throw new Error(`Piano Studio rejected MP4 webhook: ${await response.text()}`);
  }
}

async function processJob(job) {
  const workDir = await mkdtemp(path.join(tmpdir(), "recording-converter-"));
  const inputPath = path.join(workDir, "input.webm");
  const outputPath = path.join(workDir, "output.mp4");

  try {
    console.log(`[converter] Downloading ${job.source_key}`);
    const sourceObject = await r2.send(
      new GetObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: job.source_key,
      })
    );
    await writeBodyToFile(sourceObject.Body, inputPath);

    console.log(`[converter] Converting ${job.source_key} -> ${job.target_key}`);
    await runFfmpeg(inputPath, outputPath);

    console.log(`[converter] Uploading ${job.target_key}`);
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: job.target_key,
        Body: createReadStream(outputPath),
        ContentType: "video/mp4",
      })
    );

    const mp4Url = job.target_url || getPublicUrl(job.target_key);

    if (job.recording_id) {
      const { error: recordingError } = await supabase
        .from("classroom_recordings")
        .update({ url: mp4Url })
        .eq("id", job.recording_id);

      if (recordingError) throw recordingError;
    }

    const { error: jobError } = await supabase
      .from("recording_conversion_jobs")
      .update({
        status: "completed",
        target_url: mp4Url,
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (jobError) throw jobError;

    try {
      await notifyPianoStudio(job, mp4Url);
    } catch (error) {
      console.error("[converter] MP4 notification failed:", error);
    }

    console.log(`[converter] Completed ${job.id}: ${mp4Url}`);
  } finally {
    await rm(workDir, { recursive: true, force: true });
  }
}

async function failJob(job, error) {
  const attempts = job.attempts || 1;
  const shouldRetry = attempts < maxAttempts;
  const message = error instanceof Error ? error.message : String(error);

  await supabase
    .from("recording_conversion_jobs")
    .update({
      status: shouldRetry ? "pending" : "failed",
      error: message,
      locked_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", job.id);

  console.error(`[converter] ${shouldRetry ? "Retrying" : "Failed"} ${job.id}:`, message);
}

console.log("[converter] Recording converter worker started");

while (!shouldStop) {
  try {
    const job = await claimNextJob();

    if (!job) {
      await sleep(pollMs);
      continue;
    }

    try {
      await processJob(job);
    } catch (error) {
      await failJob(job, error);
    }
  } catch (error) {
    console.error("[converter] Worker loop error:", error);
    await sleep(pollMs);
  }
}

console.log("[converter] Recording converter worker stopped");
