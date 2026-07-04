/**
 * Genera un Excel de prueba con empleados ficticios argentinos.
 * Usa nombres de columnas variados para testear el mapeo automático.
 *
 * Uso: node backend/scripts/generateTestExcel.js
 * Output: backend/uploads/test-empleados.xlsx
 */

import ExcelJS from "exceljs";
import { fileURLToPath } from "url";
import path from "path";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT = path.join(__dirname, "../uploads/test-empleados.xlsx");

// Empleados ficticios con datos argentinos realistas
const EMPLEADOS = [
  { legajo: "001", "nombre empleado": "Valentina", apellido: "García", "mail laboral": "vgarcia@empresa.com", "puesto / cargo": "Gerente de RRHH",       "sector": "Recursos Humanos", "jefe directo": "",              "fecha de ingreso": "2019-03-15", activo: "Sí" },
  { legajo: "002", "nombre empleado": "Martín",    apellido: "Rodríguez", "mail laboral": "mrodriguez@empresa.com", "puesto / cargo": "Desarrollador Sr",   "sector": "Tecnología",       "jefe directo": "lherrera@empresa.com", "fecha de ingreso": "2020-07-01", activo: "Sí" },
  { legajo: "003", "nombre empleado": "Lucía",     apellido: "Herrera",   "mail laboral": "lherrera@empresa.com", "puesto / cargo": "Tech Lead",           "sector": "Tecnología",       "jefe directo": "vgarcia@empresa.com",  "fecha de ingreso": "2018-01-10", activo: "Sí" },
  { legajo: "004", "nombre empleado": "Nicolás",   apellido: "López",     "mail laboral": "nlopez@empresa.com",   "puesto / cargo": "Analista Comercial",  "sector": "Comercial",        "jefe directo": "amoreno@empresa.com",  "fecha de ingreso": "2021-05-20", activo: "Sí" },
  { legajo: "005", "nombre empleado": "Ana",       apellido: "Moreno",    "mail laboral": "amoreno@empresa.com",  "puesto / cargo": "Jefa Comercial",      "sector": "Comercial",        "jefe directo": "vgarcia@empresa.com",  "fecha de ingreso": "2017-09-03", activo: "Sí" },
  { legajo: "006", "nombre empleado": "Santiago",  apellido: "Fernández", "mail laboral": "sfernandez@empresa.com","puesto / cargo": "Contador Sr",        "sector": "Administración",   "jefe directo": "pmartinez@empresa.com","fecha de ingreso": "2020-02-14", activo: "Sí" },
  { legajo: "007", "nombre empleado": "Paula",     apellido: "Martínez",  "mail laboral": "pmartinez@empresa.com","puesto / cargo": "Gerente Administrativo","sector": "Administración", "jefe directo": "vgarcia@empresa.com",  "fecha de ingreso": "2016-11-30", activo: "Sí" },
  { legajo: "008", "nombre empleado": "Tomás",     apellido: "González",  "mail laboral": "tgonzalez@empresa.com","puesto / cargo": "Desarrollador Jr",   "sector": "Tecnología",       "jefe directo": "lherrera@empresa.com", "fecha de ingreso": "2022-08-15", activo: "Sí" },
  { legajo: "009", "nombre empleado": "Camila",    apellido: "Díaz",      "mail laboral": "cdiaz@empresa.com",    "puesto / cargo": "Diseñadora UX",      "sector": "Tecnología",       "jefe directo": "lherrera@empresa.com", "fecha de ingreso": "2021-11-01", activo: "Sí" },
  { legajo: "010", "nombre empleado": "Andrés",    apellido: "Ruiz",      "mail laboral": "aruiz@empresa.com",    "puesto / cargo": "Ejecutivo de Cuentas","sector": "Comercial",       "jefe directo": "amoreno@empresa.com",  "fecha de ingreso": "2023-01-09", activo: "Sí" },
  { legajo: "011", "nombre empleado": "Florencia", apellido: "Torres",    "mail laboral": "ftorres@empresa.com",  "puesto / cargo": "Analista de RRHH",   "sector": "Recursos Humanos", "jefe directo": "vgarcia@empresa.com",  "fecha de ingreso": "2022-04-18", activo: "Sí" },
  { legajo: "012", "nombre empleado": "Ignacio",   apellido: "Sánchez",   "mail laboral": "isanchez@empresa.com", "puesto / cargo": "DevOps",             "sector": "Tecnología",       "jefe directo": "lherrera@empresa.com", "fecha de ingreso": "2020-10-05", activo: "Sí" },
  { legajo: "013", "nombre empleado": "Sofía",     apellido: "Ramírez",   "mail laboral": "sramirez@empresa.com", "puesto / cargo": "Asistente Admin",    "sector": "Administración",   "jefe directo": "pmartinez@empresa.com","fecha de ingreso": "2023-06-01", activo: "Sí" },
  { legajo: "014", "nombre empleado": "Facundo",   apellido: "Castro",    "mail laboral": "fcastro@empresa.com",  "puesto / cargo": "Analista de Datos",  "sector": "Tecnología",       "jefe directo": "lherrera@empresa.com", "fecha de ingreso": "2021-03-22", activo: "Sí" },
  { legajo: "015", "nombre empleado": "Julieta",   apellido: "Vega",      "mail laboral": "jvega@empresa.com",    "puesto / cargo": "Ejecutiva de Cuentas","sector": "Comercial",       "jefe directo": "amoreno@empresa.com",  "fecha de ingreso": "2022-09-14", activo: "No" },
];

async function main() {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Empleados");

  // Headers con nombres variados (para testear el fuzzy matching)
  const headers = Object.keys(EMPLEADOS[0]);
  ws.addRow(headers);

  // Estilo del header
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8F0FE" },
  };

  // Datos
  EMPLEADOS.forEach(emp => {
    ws.addRow(Object.values(emp));
  });

  // Ancho de columnas
  ws.columns.forEach(col => { col.width = 22; });

  // Guardar
  fs.mkdirSync(path.dirname(OUTPUT), { recursive: true });
  await wb.xlsx.writeFile(OUTPUT);
  console.log(`✓ Excel generado: ${OUTPUT}`);
  console.log(`  ${EMPLEADOS.length} empleados`);
  console.log(`  Columnas: ${headers.join(", ")}`);
  console.log(`\n  Subilo en la app: Sincronizar Excel → Subir archivo Excel`);
}

main().catch(console.error);
