export class GguiRenderError extends Error {
  constructor(message, { code = "GGUI_RENDER_INVALID", status = 400, data, cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "GguiRenderError";
    this.code = code;
    this.status = status;
    this.data = data;
  }
}

export function gguiRenderValidationError(message, data) {
  return new GguiRenderError(message, {
    code: "GGUI_RENDER_INVALID",
    status: 400,
    data
  });
}
