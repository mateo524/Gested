import { can } from "../utils/accessControl.js";

export function permit(...permisosRequeridos) {
  return async (req, res, next) => {
    const permisosUsuario = req.user?.permisos || [];

    const autorizaciones = await Promise.all(
      permisosRequeridos.map(
        async (permiso) => permisosUsuario.includes(permiso) || await can(req.user, permiso)
      )
    );
    const autorizado = autorizaciones.every(Boolean);

    if (!autorizado) {
      return res.status(403).json({
        mensaje: "No tenés permisos para hacer esto",
      });
    }

    next();
  };
}
