export const config = {
  port: parseInt(process.env.PORT || "3001", 10),
  // Fiber testnet RPC defaults to localhost:8227 (no auth — binds 127.0.0.1 only)
  fiberRpcUrl: process.env.FIBER_RPC_URL || "http://localhost:8227",
  syncIntervalMinutes: parseInt(process.env.SYNC_INTERVAL_MINUTES || "5", 10),
  syncEnabled: process.env.SYNC_ENABLED !== "false",
  debugMode: process.env.DEBUG_MODE === "true",
  nodeEnv: process.env.NODE_ENV || "development",
  // Fiber chain: "testnet" or "mainnet"
  chain: process.env.FIBER_CHAIN || "testnet",
  // Owner CKB address — tags synced payments so the dashboard filters by wallet
  ownerAddress: process.env.FIBER_OWNER_ADDRESS || "ckt1qrejnmlar3r452tcg57gvq8patctcgy8acync0hxfnyka35ywafvkqgjcxtaqyzlahkfsrke5zh7l6u3f28662lzqqthu46u",
} as const;
