export class VaultError extends Error {
  constructor(message, { code = "VAULT_ERROR", details, cause } = {}) {
    super(message, { cause });
    this.name = "VaultError";
    this.code = code;
    this.details = details;
  }
}

export function vaultError(code, message, details) {
  return new VaultError(message, { code, details });
}
