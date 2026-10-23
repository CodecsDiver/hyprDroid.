import { estimateClockOffset, type ClockSample } from '@/domain/listeningSync'

/** Tracks the offset between this device's clock and the database server's clock. */
export class ServerClock {
  private offsetMs = 0
  private samples: ClockSample[] = []

  constructor(private readonly fetchServerTime: () => Promise<number>, private readonly now: () => number = Date.now) {}

  async sync(rounds = 3): Promise<void> {
    for (let round = 0; round < rounds; round++) {
      const clientSentMs = this.now()
      const serverMs = await this.fetchServerTime()
      this.samples.push({ clientSentMs, serverMs, clientReceivedMs: this.now() })
    }
    this.samples = this.samples.slice(-9)
    this.offsetMs = estimateClockOffset(this.samples)
  }

  /** Current server time in ms, estimated. */
  serverNow(): number {
    return this.now() + this.offsetMs
  }

  get offset(): number {
    return this.offsetMs
  }
}
