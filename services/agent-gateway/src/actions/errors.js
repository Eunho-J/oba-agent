export class ApiFuseGuardError extends Error {
  constructor(message, { code = "APIFUSE_GUARD_ERROR", status = 500, cause, data } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "ApiFuseGuardError";
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

export function validationError(message, data) {
  return new ApiFuseGuardError(message, {
    code: "VALIDATION_ERROR",
    status: 400,
    data
  });
}

export function confirmationRequiredError(message, data) {
  return new ApiFuseGuardError(message, {
    code: "ACTION_CONFIRMATION_REQUIRED",
    status: 409,
    data
  });
}

export function confirmationConsumedError(message, data) {
  return new ApiFuseGuardError(message, {
    code: "ACTION_CONFIRMATION_CONSUMED",
    status: 409,
    data
  });
}
