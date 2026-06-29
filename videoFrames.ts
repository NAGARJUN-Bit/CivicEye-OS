import { spawn } from 'child_process';
import { promises as fs } from 'fs';
import os from 'os';
import path from 'path';

// How many representative frames to pull out of a video for Gemini Vision
// to analyze. Kept small and fixed so the merged-analysis prompt stays a
// single, predictable Gemini call regardless of video length.
const FRAME_COUNT: number = 5;

export interface ExtractedFrame {
  mimeType: 'image/jpeg';
  data: string; // base64
}

export interface VideoFrameExtractionResult {
  frames: ExtractedFrame[];
  durationSeconds: number;
}

function runCommand(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args);
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => { stdout += chunk.toString(); });
    child.stderr.on('data', (chunk) => { stderr += chunk.toString(); });
    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) resolve({ stdout, stderr });
      else reject(new Error(`${command} exited with code ${code}: ${stderr}`));
    });
  });
}

async function probeDurationSeconds(filePath: string): Promise<number> {
  const { stdout } = await runCommand('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration',
    '-of', 'default=noprint_wrappers=1:nokey=1',
    filePath,
  ]);
  const duration = parseFloat(stdout.trim());
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

/**
 * Extracts FRAME_COUNT representative frames evenly spaced across the
 * video's duration (skipping the very first/last edge to avoid black
 * fade-in/out frames), returning each as base64-encoded JPEG.
 */
export async function extractRepresentativeFrames(
  videoBuffer: Buffer,
  originalExtensionHint: string
): Promise<VideoFrameExtractionResult> {
  const workDir = await fs.mkdtemp(path.join(os.tmpdir(), 'civiceye-video-'));
  const inputPath = path.join(workDir, `input${originalExtensionHint}`);

  try {
    await fs.writeFile(inputPath, videoBuffer);

    const durationSeconds = await probeDurationSeconds(inputPath);

    // Spread sample points across the middle of the clip so we avoid
    // intro/outro black frames on very short videos.
    const safeDuration = durationSeconds > 0 ? durationSeconds : 1;
    const margin = safeDuration * 0.08;
    const usableStart = margin;
    const usableEnd = Math.max(safeDuration - margin, usableStart + 0.01);

    const timestamps: number[] = [];
    for (let i = 0; i < FRAME_COUNT; i++) {
      const fraction = FRAME_COUNT === 1 ? 0.5 : i / (FRAME_COUNT - 1);
      timestamps.push(usableStart + fraction * (usableEnd - usableStart));
    }

    const frames: ExtractedFrame[] = [];

    for (let i = 0; i < timestamps.length; i++) {
      const framePath = path.join(workDir, `frame-${i}.jpg`);
      await runCommand('ffmpeg', [
        '-y',
        '-ss', timestamps[i].toFixed(2),
        '-i', inputPath,
        '-frames:v', '1',
        '-q:v', '3',
        framePath,
      ]);

      try {
        const frameBuffer = await fs.readFile(framePath);
        frames.push({ mimeType: 'image/jpeg', data: frameBuffer.toString('base64') });
      } catch {
        // If a particular timestamp fails to produce a frame (e.g. extremely
        // short clip), skip it rather than failing the whole analysis.
      }
    }

    if (frames.length === 0) {
      throw new Error('Could not extract any frames from the uploaded video.');
    }

    return { frames, durationSeconds };
  } finally {
    await fs.rm(workDir, { recursive: true, force: true });
  }
}
