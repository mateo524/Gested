import jwt from "jsonwebtoken";

export function auth(req, res, next) {
  const header = req.headers.authorization;

  // Si no hay token
  if (!header || !header.startsWith("Bearer ")) {
    return res.status(401).json({ mensaje: "No autorizado" });
  }

  try {
    const token = header.split(" ")[1];

    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });

    // Guardamos info del usuario en req
    req.user = payload;

    next();
  } catch (err) {
    if (err instanceof jwt.JsonWebTokenError || err instanceof jwt.TokenExpiredError) {
      return res.status(401).json({ mensaje: "Token inválido" });
    }
    console.error(err);
    return res.status(401).json({ mensaje: "No autorizado" });
  }
}
