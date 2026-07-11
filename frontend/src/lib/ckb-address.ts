/**
 * CKB Address Utility — validation, format conversion, and display helpers.
 *
 * CKB addresses use the Bech32m encoding:
 *   - Testnet: ckt1...  (prefix "ckt")
 *   - Mainnet: ckb1...  (prefix "ckb")
 *
 * The payload (after the prefix) is identical for the same lock script,
 * so converting between testnet and mainnet is a simple prefix swap.
 */

const TESTNET_PREFIX = "ckt";
const MAINNET_PREFIX = "ckb";

/** Returns true if the string looks like a valid CKB testnet address. */
export function isTestnetAddress(address: string): boolean {
  return address.startsWith(`${TESTNET_PREFIX}1`);
}

/** Returns true if the string looks like a valid CKB mainnet address. */
export function isMainnetAddress(address: string): boolean {
  return address.startsWith(`${MAINNET_PREFIX}1`) && !address.startsWith(`${TESTNET_PREFIX}1`);
}

/** Returns true if the string looks like any CKB address (testnet or mainnet). */
export function isCkbAddress(address: string): boolean {
  return isTestnetAddress(address) || isMainnetAddress(address);
}

/**
 * Convert a CKB address between testnet and mainnet format.
 * - ckt1q... → ckb1q...
 * - ckb1q... → ckt1q...
 * Non-CKB addresses are returned unchanged.
 */
export function toggleAddressNetwork(address: string): string {
  if (isTestnetAddress(address)) {
    return MAINNET_PREFIX + address.slice(TESTNET_PREFIX.length);
  }
  if (isMainnetAddress(address)) {
    return TESTNET_PREFIX + address.slice(MAINNET_PREFIX.length);
  }
  return address;
}

/**
 * Convert any CKB address explicitly to testnet format.
 */
export function toTestnetAddress(address: string): string {
  if (isTestnetAddress(address)) return address;
  if (isMainnetAddress(address)) {
    return TESTNET_PREFIX + address.slice(MAINNET_PREFIX.length);
  }
  return address;
}

/**
 * Convert any CKB address explicitly to mainnet format.
 */
export function toMainnetAddress(address: string): string {
  if (isMainnetAddress(address)) return address;
  if (isTestnetAddress(address)) {
    return MAINNET_PREFIX + address.slice(TESTNET_PREFIX.length);
  }
  return address;
}

/**
 * Shorten a CKB address for display.
 *   shortenCkbAddress("ckt1qyqrdsefa43s6m882pcj53m4gdnj4k440axqswmu83")
 *   → "ckt1qyqr...swmu83"
 */
export function shortenCkbAddress(address: string, chars = 8): string {
  if (address.length <= chars * 2 + 6) return address;
  return `${address.slice(0, chars + 3)}...${address.slice(-chars)}`;
}

/**
 * Extract the lock script hash (payload portion) from a CKB address.
 * This is the part after the prefix and separator, before any checksum.
 * Returns null if the address doesn't look valid.
 */
export function extractAddressPayload(address: string): string | null {
  if (!isCkbAddress(address)) return null;
  // Simple heuristic: the payload starts after the 4-char prefix
  // Full format: {prefix}1{payload}{checksum}
  // Payload is typically 40-64 hex chars for CKB addresses
  const afterPrefix = isTestnetAddress(address)
    ? address.slice(TESTNET_PREFIX.length + 1)
    : address.slice(MAINNET_PREFIX.length + 1);
  // Bech32m addresses: last 6 chars are checksum
  if (afterPrefix.length <= 6) return null;
  return afterPrefix.slice(0, afterPrefix.length - 6);
}

/**
 * Get the human-readable network label for an address.
 */
export function getAddressNetworkLabel(address: string): "Testnet" | "Mainnet" | "Unknown" {
  if (isTestnetAddress(address)) return "Testnet";
  if (isMainnetAddress(address)) return "Mainnet";
  return "Unknown";
}
