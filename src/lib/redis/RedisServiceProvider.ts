import Redis, { type RedisOptions } from "ioredis";

type RedisSessionHash = Record<string, string>;

type EmailNotificationPayload = {
  to: string;
  subject: string;
  body: string;
  meta?: Record<string, string>;
};

type PubSubHandler = (message: string, channel: string) => void;

const SESSION_TTL_SECONDS = 30 * 60; // 30 minutes inactivity TTL
const EMAIL_QUEUE_KEY = "queue:email_notifications";
const PRESENCE_SET_KEY = "presence:active_users";

const toInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const withPrefix = (prefix: string, key: string): string => `${prefix}:${key}`;

class RedisServiceProvider {
  private static instance: RedisServiceProvider | null = null;

  private readonly poolSize: number;
  private readonly commandClients: Redis[];
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private nextClientIndex = 0;
  private readonly subscriptions = new Map<string, Set<PubSubHandler>>();

  private constructor() {
    this.poolSize = clamp(toInt(process.env.REDIS_POOL_SIZE, 10), 10, 50);

    const options: RedisOptions = {
      host: process.env.REDIS_HOST ?? "127.0.0.1",
      port: toInt(process.env.REDIS_PORT, 6379),
      password: process.env.REDIS_PASSWORD || undefined,
      db: toInt(process.env.REDIS_DB, 0),
      lazyConnect: true,
      connectTimeout: toInt(process.env.REDIS_CONNECT_TIMEOUT_MS, 10_000),
      maxRetriesPerRequest: toInt(process.env.REDIS_MAX_RETRIES_PER_REQUEST, 3),
      retryStrategy: (attempt: number) => {
        const maxRetries = toInt(process.env.REDIS_MAX_RETRY_ATTEMPTS, 20);
        if (attempt > maxRetries) return null;
        return Math.min(attempt * 250, 5_000);
      },
      reconnectOnError: (error: Error) => {
        const message = error.message.toLowerCase();
        if (message.includes("read only")) return true;
        return message.includes("connection refused");
      },
    };

    this.commandClients = Array.from({ length: this.poolSize }, () => new Redis(options));
    this.publisher = new Redis(options);
    this.subscriber = new Redis(options);

    for (const client of [...this.commandClients, this.publisher, this.subscriber]) {
      client.on("error", (error: unknown) => {
        const message = error instanceof Error ? error.message : String(error);
        if (message.toLowerCase().includes("connection refused")) {
          console.error("[Redis] Connection refused. Check host/port/password.");
        } else {
          console.error("[Redis] Client error:", message);
        }
      });
    }

    this.subscriber.on("message", (channel: string, message: string) => {
      const handlers = this.subscriptions.get(channel);
      if (!handlers) return;
      for (const handler of handlers) handler(message, channel);
    });
  }

  public static getInstance(): RedisServiceProvider {
    if (!RedisServiceProvider.instance) {
      RedisServiceProvider.instance = new RedisServiceProvider();
    }
    return RedisServiceProvider.instance;
  }

  public async connect(): Promise<void> {
    await Promise.all([
      ...this.commandClients.map((client) => client.connect()),
      this.publisher.connect(),
      this.subscriber.connect(),
    ]);

    if ((process.env.REDIS_APPLY_VOLATILE_LRU ?? "false").toLowerCase() === "true") {
      await this.tryApplyVolatileLruPolicy();
    }
  }

  public async disconnect(): Promise<void> {
    await Promise.all([
      ...this.commandClients.map((client) => client.quit()),
      this.publisher.quit(),
      this.subscriber.quit(),
    ]);
  }

  private getCommandClient(): Redis {
    const client = this.commandClients[this.nextClientIndex];
    this.nextClientIndex = (this.nextClientIndex + 1) % this.commandClients.length;
    return client;
  }

  private async run<T>(operation: (client: Redis) => Promise<T>): Promise<T> {
    try {
      return await operation(this.getCommandClient());
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.toLowerCase().includes("connection refused")) {
        throw new Error("Redis connection refused. Verify Redis is running on port 6379.");
      }
      throw error;
    }
  }

  private async tryApplyVolatileLruPolicy(): Promise<void> {
    await this.run(async (client) => {
      await client.config("SET", "maxmemory-policy", "volatile-lru");
      return undefined;
    });
  }

  // Session token as string
  public async setSessionToken(token: string, value: string): Promise<void> {
    await this.run(async (client) => {
      await client.set(withPrefix("session:token", token), value, "EX", SESSION_TTL_SECONDS);
      return undefined;
    });
  }

  public async getSessionToken(token: string): Promise<string | null> {
    return this.run((client) => client.get(withPrefix("session:token", token)));
  }

  public async deleteSessionToken(token: string): Promise<void> {
    await this.run(async (client) => {
      await client.del(withPrefix("session:token", token));
      return undefined;
    });
  }

  // Session details as hash
  public async setSessionData(sessionId: string, data: RedisSessionHash): Promise<void> {
    await this.run(async (client) => {
      const key = withPrefix("session:data", sessionId);
      await client.hset(key, data);
      await client.expire(key, SESSION_TTL_SECONDS);
      return undefined;
    });
  }

  public async getSessionData(sessionId: string): Promise<RedisSessionHash> {
    return this.run((client) => client.hgetall(withPrefix("session:data", sessionId)));
  }

  public async touchSession(sessionId: string): Promise<void> {
    await this.run(async (client) => {
      const key = withPrefix("session:data", sessionId);
      await client.expire(key, SESSION_TTL_SECONDS);
      return undefined;
    });
  }

  // Email notification queue (producer/consumer)
  public async enqueueEmailNotification(payload: EmailNotificationPayload): Promise<number> {
    return this.run((client) => client.lpush(EMAIL_QUEUE_KEY, JSON.stringify(payload)));
  }

  public async dequeueEmailNotification(): Promise<EmailNotificationPayload | null> {
    const raw = await this.run((client) => client.rpop(EMAIL_QUEUE_KEY));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as EmailNotificationPayload;
    } catch {
      return null;
    }
  }

  // Presence tracking with unique user IDs
  public async addActiveUser(userId: string): Promise<void> {
    await this.run(async (client) => {
      await client.sadd(PRESENCE_SET_KEY, userId);
      return undefined;
    });
  }

  public async removeActiveUser(userId: string): Promise<void> {
    await this.run(async (client) => {
      await client.srem(PRESENCE_SET_KEY, userId);
      return undefined;
    });
  }

  public async isUserActive(userId: string): Promise<boolean> {
    const exists = await this.run((client) => client.sismember(PRESENCE_SET_KEY, userId));
    return exists === 1;
  }

  public async getActiveUsers(): Promise<string[]> {
    return this.run((client) => client.smembers(PRESENCE_SET_KEY));
  }

  // Pub/Sub wrapper for websocket fanout
  public async publish(channel: string, message: string): Promise<number> {
    try {
      return await this.publisher.publish(channel, message);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      if (text.toLowerCase().includes("connection refused")) {
        throw new Error("Redis publisher connection refused.");
      }
      throw error;
    }
  }

  public async subscribe(channel: string, handler: PubSubHandler): Promise<void> {
    const current = this.subscriptions.get(channel) ?? new Set<PubSubHandler>();
    current.add(handler);
    this.subscriptions.set(channel, current);

    if (current.size === 1) {
      await this.subscriber.subscribe(channel);
    }
  }

  public async unsubscribe(channel: string, handler?: PubSubHandler): Promise<void> {
    if (!this.subscriptions.has(channel)) return;
    if (!handler) {
      this.subscriptions.delete(channel);
      await this.subscriber.unsubscribe(channel);
      return;
    }

    const current = this.subscriptions.get(channel);
    if (!current) return;
    current.delete(handler);
    if (current.size === 0) {
      this.subscriptions.delete(channel);
      await this.subscriber.unsubscribe(channel);
    } else {
      this.subscriptions.set(channel, current);
    }
  }
}

export const redisServiceProvider = RedisServiceProvider.getInstance();
export { RedisServiceProvider };
export type { EmailNotificationPayload, RedisSessionHash, PubSubHandler };
