/** Normalize login emails the same way the User schema stores them. */
export function normalizeEmail(email) {
  return String(email).trim().toLowerCase();
}

/** Map Mongo/Mongoose errors to HTTP-friendly Error instances. */
export function toHttpError(err) {
  if (!err || typeof err !== "object") {
    const e = new Error("Internal error");
    e.status = 500;
    return e;
  }

  if (err.status && err.status < 500) return err;

  // Duplicate key (e.g. race on unique email)
  if (err.code === 11000) {
    const e = new Error("Email already registered");
    e.status = 409;
    return e;
  }

  if (err.name === "ValidationError") {
    const e = new Error("Validation failed");
    e.status = 400;
    e.details = err.errors;
    return e;
  }

  if (err.name === "CastError") {
    const e = new Error("Invalid id");
    e.status = 400;
    return e;
  }

  if (err.status && err.status >= 400 && err.status < 600) {
    return err;
  }

  return err;
}

export function logAuth(event, meta = {}, err = null) {
  const payload = { ...meta, ts: Date.now() };
  if (err) {
    console.error(`[auth] ${event}`, payload, err.message, err.stack);
  } else {
    console.log(`[auth] ${event}`, payload);
  }
}
