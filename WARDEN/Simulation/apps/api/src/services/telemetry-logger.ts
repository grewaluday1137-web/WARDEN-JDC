import fs from 'fs';
import path from 'path';
import { TickPayload, TickPayloadDelta } from '../types';

export class TelemetryLogger {
  private logStream: fs.WriteStream | null = null;
  private logDir: string;

  constructor() {
    this.logDir = path.join(process.cwd(), 'data', 'telemetry-logs');
    if (!fs.existsSync(this.logDir)) {
      fs.mkdirSync(this.logDir, { recursive: true });
    }
  }

  public startSession(sessionId: string) {
    if (this.logStream) {
      this.logStream.close();
    }
    const logFile = path.join(this.logDir, `session_${sessionId}.ndjson`);
    this.logStream = fs.createWriteStream(logFile, { flags: 'a' });
    console.log(`[Telemetry] Started NDJSON logging to ${logFile}`);
  }

  public endSession() {
    if (this.logStream) {
      this.logStream.close();
      this.logStream = null;
    }
  }

  public logTick(payload: TickPayload | TickPayloadDelta) {
    if (this.logStream) {
      // Writing as newline-delimited JSON (NDJSON)
      // This is perfectly ready to be piped to SQLite or an AI multimodal engine 
      this.logStream.write(JSON.stringify({ ...payload, loggedAt: Date.now() }) + '\n');
    }
  }
}
