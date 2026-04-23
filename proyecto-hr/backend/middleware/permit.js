export function permit(...permisosRequeridos) {
  return (req, res, next) => {
    const permisosUsuario = req.user?.permisos || [];

    const autorizado = permisosRequeridos.every((permiso) =>
      permisosUsuario.includes(permiso)
    );

    if (!autorizado) {
      return res.status(403).json({
        mensaje: "No tenés permisos para hacer esto",
      });
    }

    next();
  };
}