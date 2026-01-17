import type {
  RustCreateResponse,
  RustChoiceResponse,
  RustStateResponse,
  RustResponse,
} from "./types.ts";

interface BattleProcess {
  process: Deno.ChildProcess;
  stdin: WritableStreamDefaultWriter<Uint8Array>;
  reader: ReadableStreamDefaultReader<Uint8Array>;
  battleId: string;
  createdAt: number;
  buffer: string;
}

const BATTLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

export class BattleManager {
  private battles: Map<string, BattleProcess> = new Map();
  private rustBinaryPath: string;
  private cleanupInterval: number;
  private encoder = new TextEncoder();
  private decoder = new TextDecoder();

  constructor(rustBinaryPath?: string) {
    // Default to debug build path relative to server directory
    this.rustBinaryPath =
      rustBinaryPath ??
      (Deno.build.os === "windows"
        ? "../pokemon-showdown-rs/target/debug/battle_runner.exe"
        : "../pokemon-showdown-rs/target/debug/battle_runner");

    // Cleanup stale battles every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanupStaleBattles(), 5 * 60 * 1000);
  }

  async createBattle(seed?: number): Promise<RustCreateResponse> {
    const command = new Deno.Command(this.rustBinaryPath, {
      stdin: "piped",
      stdout: "piped",
      stderr: "null", // Ignore stderr to avoid debug output
    });

    const process = command.spawn();
    const stdin = process.stdin.getWriter();
    const reader = process.stdout.getReader();

    // Store battle process first so readLine can access it
    const battleProcess: BattleProcess = {
      process,
      stdin,
      reader,
      battleId: "", // Will be set after response
      createdAt: Date.now(),
      buffer: "",
    };

    // Send create command
    const createCmd = JSON.stringify({ type: "create", seed }) + "\n";
    await stdin.write(this.encoder.encode(createCmd));

    // Read response
    const response = await this.readLine<RustCreateResponse>(battleProcess);

    if (!response.ok) {
      await this.killProcess(battleProcess);
      throw new Error((response as { error: string }).error);
    }

    const battleId = response.battle_id;
    battleProcess.battleId = battleId;

    // Store the battle process
    this.battles.set(battleId, battleProcess);

    return response;
  }

  async makeChoice(
    battleId: string,
    choice: string
  ): Promise<RustChoiceResponse> {
    const battle = this.battles.get(battleId);
    if (!battle) {
      throw new Error(`Battle not found: ${battleId}`);
    }

    // Send choice command
    const choiceCmd = JSON.stringify({ type: "choice", choice }) + "\n";
    await battle.stdin.write(this.encoder.encode(choiceCmd));

    // Read response
    const response = await this.readLine<RustChoiceResponse>(battle);

    // If battle ended, clean up
    if (response.ok && response.ended) {
      await this.cleanupBattle(battleId);
    }

    return response;
  }

  async getState(battleId: string): Promise<RustStateResponse> {
    const battle = this.battles.get(battleId);
    if (!battle) {
      throw new Error(`Battle not found: ${battleId}`);
    }

    // Send state command
    const stateCmd = JSON.stringify({ type: "state" }) + "\n";
    await battle.stdin.write(this.encoder.encode(stateCmd));

    // Read response
    return await this.readLine<RustStateResponse>(battle);
  }

  async cleanupBattle(battleId: string): Promise<void> {
    const battle = this.battles.get(battleId);
    if (!battle) return;

    try {
      // Send quit command
      const quitCmd = JSON.stringify({ type: "quit" }) + "\n";
      await battle.stdin.write(this.encoder.encode(quitCmd));
    } catch {
      // Ignore errors when sending quit
    }

    await this.killProcess(battle);
    this.battles.delete(battleId);
  }

  hasBattle(battleId: string): boolean {
    return this.battles.has(battleId);
  }

  private async readLine<T extends RustResponse>(battle: BattleProcess): Promise<T> {
    // Read until we get a complete line
    while (true) {
      const newlineIdx = battle.buffer.indexOf("\n");
      if (newlineIdx !== -1) {
        const line = battle.buffer.slice(0, newlineIdx);
        battle.buffer = battle.buffer.slice(newlineIdx + 1);
        return JSON.parse(line) as T;
      }

      const { done, value } = await battle.reader.read();
      if (done) {
        throw new Error("Process ended unexpectedly");
      }
      battle.buffer += this.decoder.decode(value);
    }
  }

  private async killProcess(battle: BattleProcess): Promise<void> {
    try {
      battle.reader.releaseLock();
    } catch {
      // Ignore
    }
    try {
      battle.stdin.releaseLock();
    } catch {
      // Ignore
    }
    try {
      battle.process.kill();
    } catch {
      // Ignore
    }
  }

  private cleanupStaleBattles(): void {
    const now = Date.now();
    for (const [battleId, battle] of this.battles) {
      if (now - battle.createdAt > BATTLE_TIMEOUT_MS) {
        console.log(`Cleaning up stale battle: ${battleId}`);
        this.cleanupBattle(battleId);
      }
    }
  }

  async shutdown(): Promise<void> {
    clearInterval(this.cleanupInterval);
    for (const battleId of this.battles.keys()) {
      await this.cleanupBattle(battleId);
    }
  }
}
