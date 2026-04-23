export default function DashboardPage() {
  return (
    <div className="grid md:grid-cols-4 gap-6">
      {[
        ["Usuarios activos", "Sistema conectado"],
        ["Seguridad", "Login OK"],
        ["Permisos", "Habilitados"],
        ["Estado", "Operativo"],
      ].map(([title, value]) => (
        <div
          key={title}
          className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm"
        >
          <p className="text-slate-500">{title}</p>
          <h3 className="text-3xl font-bold mt-2">{value}</h3>
        </div>
      ))}
    </div>
  );
}