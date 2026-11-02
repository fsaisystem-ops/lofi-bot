import { spawn, type ChildProcess } from "node:child_process";
import { streamLogger } from "@/utils/logger";
import type { IStreamService } from "./interfaces/IStreamService";

export class StreamService implements IStreamService {
  createStream(url: string): ChildProcess {
    const proc = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "warning",
        "-reconnect",
        "1",
        "-reconnect_streamed",
        "1",
        "-reconnect_delay_max",
        "5",
        "-user_agent",
        "Mozilla/5.0",
        "-i",
        url,
        "-vn",
        "-f",
        "ogg",
        "-c:a",
        "libopus",
        "-ar",
        "48000",
        "-ac",
        "2",
        "-b:a",
        "96k",
        "-application",
        "audio",
        "-frame_duration",
        "20",
        "pipe:1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    proc.stderr?.on("data", (chunk: Buffer) => {
      const line = chunk.toString().trim();
      if (line) {
        streamLogger.warn({ ffmpeg: line }, "ffmpeg");
      }
    });

    proc.on("error", (error) => {
      streamLogger.error({ err: error }, "ffmpeg failed to start");
    });

    return proc;
  }
}
