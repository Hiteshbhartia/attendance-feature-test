import jwt from "jsonwebtoken";

/** Build a JWT-safe payload (plain strings only). */
export function tokenPayload(user) {
  return {
    id: String(user._id ?? user.id),
    role: typeof user.role === "string" ? user.role.toLowerCase() : user.role,
    ...(user.employeeId ? { employeeId: String(user.employeeId) } : {}),
  };
}

export function signToken(userOrPayload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const err = new Error("JWT_SECRET is not configured");
    err.status = 500;
    throw err;
  }

  const payload =
    userOrPayload.id && userOrPayload.role && !userOrPayload._id
      ? userOrPayload
      : tokenPayload(userOrPayload);

  try {
    return jwt.sign(payload, secret, {
      expiresIn: process.env.JWT_EXPIRES_IN || "7d",
    });
  } catch (err) {
    console.error("[auth] signToken failed:", err.message);
    const e = new Error("Could not issue session token");
    e.status = 500;
    throw e;
  }
}

export function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    console.log("[auth:debug] requireAuth called:", {
      path: req.path,
      hasAuthHeader: !!req.headers.authorization,
      headerPreview: header.substring(0, 30) + (header.length > 30 ? "..." : ""),
      tokenExtracted: !!token,
      tokenLength: token ? token.length : 0,
    });

    if (!token) return res.status(401).json({ error: "Missing token" });

    const secret = process.env.JWT_SECRET;
    console.log("[auth:debug] JWT_SECRET present:", !!secret, "length:", secret ? secret.length : 0);

    if (!secret) {
      console.error("[auth] JWT_SECRET missing on authenticated request");
      return res.status(500).json({ error: "Auth is not configured" });
    }

    const decoded = jwt.verify(token, secret);
    console.log("[auth:debug] jwt.verify SUCCESS, decoded:", {
      id: decoded.id,
      role: decoded.role,
      employeeId: decoded.employeeId,
      iat: decoded.iat,
      exp: decoded.exp,
    });

    req.user = {
      id: String(decoded.id),
      role: typeof decoded.role === "string" ? decoded.role.toLowerCase() : decoded.role,
      ...(decoded.employeeId ? { employeeId: String(decoded.employeeId) } : {}),
    };
    console.log("[auth:debug] req.user set:", req.user);
    next();
  } catch (err) {
    console.warn("[auth:debug] requireAuth FAILED:", {
      errorName: err.name,
      errorMessage: err.message,
      secretPresent: !!process.env.JWT_SECRET,
      secretLength: process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 0,
    });
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: "Unauthenticated" });
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Forbidden" });
    }
    next();
  };
}
