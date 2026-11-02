import type { ChildProcess } from "node:child_process";

export interface IStreamService {
  createStream(url: string): ChildProcess;
}
