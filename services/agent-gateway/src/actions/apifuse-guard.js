import { callApiFuseOperation } from "../clients/apifuse.js";
import { ConfirmationTokenStore } from "./confirmation-token-store.js";
import { confirmationRequiredError, validationError } from "./errors.js";

export function createApiFuseGuardService({
  root = process.cwd(),
  apifuseConfig = {},
  tokenStore = new ConfirmationTokenStore({ root }),
  client = callApiFuseOperation,
  now = () => new Date()
} = {}) {
  const baseUrl = apifuseConfig.baseUrl || "https://api.apifuse.com";
  const apiKey = apifuseConfig.apiKey || "";

  return {
    async discover(payload) {
      const action = normalizeActionPayload(payload);
      return {
        providerId: action.providerId,
        operationId: action.operationId,
        body: action.body,
        connectionId: action.connectionId,
        actionExecuted: false,
        confirmationRequired: true
      };
    },

    async prepareAction(payload) {
      const action = normalizeActionPayload(payload);
      const token = await tokenStore.createToken({
        providerId: action.providerId,
        operationId: action.operationId,
        body: action.body,
        now: now()
      });
      return {
        providerId: action.providerId,
        operationId: action.operationId,
        body: action.body,
        actionExecuted: false,
        confirmationRequired: true,
        confirmationToken: {
          id: token.id,
          consumed: token.consumed,
          createdAt: token.createdAt,
          consumedAt: token.consumedAt,
          expiresAt: token.expiresAt
        }
      };
    },

    async executeConfirmed(payload) {
      const action = normalizeActionPayload(payload);
      const tokenId = normalizeTokenId(payload?.confirmationTokenId);
      if (!tokenId) {
        throw confirmationRequiredError("confirmationTokenId is required to execute ApiFuse action", {
          providerId: action.providerId,
          operationId: action.operationId
        });
      }
      const consumedToken = await tokenStore.consumeTokenForAction({
        tokenId,
        providerId: action.providerId,
        operationId: action.operationId,
        body: action.body,
        now: now()
      });

      const result = await client({
        baseUrl,
        apiKey,
        providerId: action.providerId,
        operationId: action.operationId,
        body: action.body,
        connectionId: action.connectionId
      });

      return {
        providerId: action.providerId,
        operationId: action.operationId,
        actionExecuted: true,
        confirmationRequired: false,
        confirmationToken: {
          id: consumedToken.id,
          consumed: consumedToken.consumed,
          consumedAt: consumedToken.consumedAt
        },
        result
      };
    }
  };
}

function normalizeActionPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw validationError("request body must be a JSON object");
  }

  const providerId = normalizeRequiredString(payload.providerId, "providerId");
  const operationId = normalizeRequiredString(payload.operationId, "operationId");
  const connectionId = payload.connectionId === undefined || payload.connectionId === null
    ? null
    : normalizeRequiredString(payload.connectionId, "connectionId");
  const body = payload.body === undefined ? {} : payload.body;
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    throw validationError("body must be a JSON object");
  }

  return { providerId, operationId, body, connectionId };
}

function normalizeRequiredString(value, field) {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw validationError(`${field} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeTokenId(value) {
  if (typeof value !== "string") return "";
  return value.trim();
}
