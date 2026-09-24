import { MongoClient, type Collection, type Document } from "mongodb";
import { env } from "./env.js";

let client: MongoClient | null = null;

export async function getMongoClient(): Promise<MongoClient> {
  if (!client) {
    client = new MongoClient(env.MONGODB_URI);
    await client.connect();
  }
  return client;
}

export interface ActivityEventDocument {
  eventId: string;
  tenantId: string;
  studentId: string | null;
  assessmentId?: string | null;
  attemptId: string | null;
  eventType: "attempt.succeeded" | "attempt.rejected";
  requestId: string;
  occurredAt: Date;
  metadata?: Record<string, any>;
}

let indexesInitialized = false;

export async function getActivityEventsCollection(): Promise<Collection<ActivityEventDocument>> {
  const mongo = await getMongoClient();
  const db = mongo.db();
  const collection = db.collection<ActivityEventDocument>("activity_events");

  if (!indexesInitialized) {
    await collection.createIndex({ eventId: 1 }, { unique: true });
    await collection.createIndex({ tenantId: 1, occurredAt: -1 });
    await collection.createIndex({ tenantId: 1, studentId: 1, occurredAt: -1 });
    indexesInitialized = true;
  }

  return collection;
}

export async function closeMongo(): Promise<void> {
  if (client) {
    await client.close();
    client = null;
    indexesInitialized = false;
  }
}
