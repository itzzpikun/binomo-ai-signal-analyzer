// ============================================================
// src/config/database.ts — MongoDB connection via Mongoose
// Falls back to in-memory MongoDB when no server is reachable
// ============================================================
import mongoose from 'mongoose';
import ENV from './env';

let isConnected = false;

export async function connectDatabase(): Promise<void> {
  if (isConnected) return;

  try {
    mongoose.set('strictQuery', true);

    let uri = ENV.MONGODB_URI;

    // Try connecting to configured URI first
    try {
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 4000,
        socketTimeoutMS: 45000,
      });
      console.log('[DB] MongoDB connected:', uri);
    } catch (_err) {
      // Fall back to in-memory MongoDB for development
      console.warn('[DB] Cannot reach MongoDB at', uri, '— starting in-memory MongoDB...');
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { MongoMemoryServer } = require('mongodb-memory-server');
        const mongod = await MongoMemoryServer.create();
        uri = mongod.getUri();
        await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
        console.log('[DB] In-memory MongoDB started at:', uri);
      } catch (memErr) {
        console.error('[DB] In-memory MongoDB also failed:', (memErr as Error).message);
        console.warn('[DB] Continuing without database — signal history and performance tracking disabled.');
        return;
      }
    }

    isConnected = true;
    console.log('[DB] MongoDB ready.');

    mongoose.connection.on('error', (err) => {
      console.error('[DB] Connection error:', err.message);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[DB] MongoDB disconnected. Will reconnect on next request.');
      isConnected = false;
    });
  } catch (err) {
    console.error('[DB] Failed to connect to MongoDB:', (err as Error).message);
    throw err;
  }
}

export function getDatabaseStatus(): { connected: boolean; host: string } {
  return {
    connected: mongoose.connection.readyState === 1,
    host: mongoose.connection.host ?? 'unknown',
  };
}
