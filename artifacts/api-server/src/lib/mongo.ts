import { MongoClient, type Db } from "mongodb";

const databaseName = "noir_coffee";
let mongoClientPromise: Promise<MongoClient> | undefined;

export async function getMongoDatabase(): Promise<Db> {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    throw new Error("MONGODB_URI is not configured.");
  }

  if (!mongoClientPromise) {
    const client = new MongoClient(uri, {
      appName: "NOIR Coffee API",
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 6000,
    });
    mongoClientPromise = client.connect().catch((error: unknown) => {
      mongoClientPromise = undefined;
      throw error;
    });
  }

  const client = await mongoClientPromise;
  return client.db(databaseName);
}
