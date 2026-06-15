/**
 * seedCorp.mjs — Demo seed for a large corporate company (~120 employees)
 * Departments: Dirección, Ventas, Marketing, Producto, Tecnología,
 *              Operaciones, Finanzas, RRHH, Customer Success, Legal
 *
 * Usage: node --env-file=.env scripts/seedCorp.mjs
 */

import "dotenv/config";
import mongoose from "mongoose";

const MONGO = process.env.MONGO_URI_DIRECT || process.env.MONGO_URI;
if (!MONGO) throw new Error("MONGO_URI_DIRECT or MONGO_URI must be set in environment");
await mongoose.connect(MONGO);
const db = mongoose.connection.db;

// ─── IDs ─────────────────────────────────────────────────────────────────────
const companyId = new mongoose.Types.ObjectId("6b29b32aee3b9f7a50c3042c");
const schoolId  = new mongoose.Types.ObjectId("6b29b32aee3b9f7a50c3042d"); // "school" = org unit

// ─── Clean ───────────────────────────────────────────────────────────────────
const COLS = ["employees","competencies","evaluationcycles","schools","companies","records","kpirecords"];
for (const col of COLS) await db.collection(col).deleteMany({ companyId });
console.log("Cleaned previous corp seed.");

// ─── Company ─────────────────────────────────────────────────────────────────
await db.collection("companies").insertOne({
  _id: companyId,
  nombre: "ZENTOR Corp S.A.",
  slug: "zentor-corp",
  plan: "enterprise",
  activa: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// ─── School (org unit required by model) ─────────────────────────────────────
await db.collection("schools").insertOne({
  _id: schoolId,
  companyId,
  nombre: "ZENTOR Corp S.A.",
  activa: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────
const oid = () => new mongoose.Types.ObjectId();
const date = (y, m, d) => new Date(y, m - 1, d);
const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];

// ─── Department heads (created first for managerId refs) ──────────────────────
const heads = {
  direccion:       oid(),
  ventas:          oid(),
  marketing:       oid(),
  producto:        oid(),
  tecnologia:      oid(),
  operaciones:     oid(),
  finanzas:        oid(),
  rrhh:            oid(),
  customerSuccess: oid(),
  legal:           oid(),
};

// ─── Employee definitions ─────────────────────────────────────────────────────
const employees = [

  // ── Dirección (5) ───────────────────────────────────────────────────────────
  { _id: heads.direccion,       nombre: "Alejandro", apellido: "Paredes",    email: "aparedes@corp.com",     cargo: "CEO",                    area: "Dirección",        tipoEmpleado: "DIRECTIVO", managerId: null,               fechaIngreso: date(2019,3,1),  legajo: "D-001" },
  { _id: oid(),                 nombre: "Valentina", apellido: "Ríos",       email: "vrios@corp.com",        cargo: "COO",                    area: "Dirección",        tipoEmpleado: "DIRECTIVO", managerId: heads.direccion,    fechaIngreso: date(2019,6,15), legajo: "D-002" },
  { _id: oid(),                 nombre: "Sebastián", apellido: "Moreno",     email: "smoreno@corp.com",      cargo: "CFO",                    area: "Dirección",        tipoEmpleado: "DIRECTIVO", managerId: heads.direccion,    fechaIngreso: date(2020,1,10), legajo: "D-003" },
  { _id: oid(),                 nombre: "Luciana",   apellido: "Castillo",   email: "lcastillo@corp.com",    cargo: "CTO",                    area: "Dirección",        tipoEmpleado: "DIRECTIVO", managerId: heads.direccion,    fechaIngreso: date(2020,3,1),  legajo: "D-004" },
  { _id: oid(),                 nombre: "Rodrigo",   apellido: "Vega",       email: "rvega@corp.com",        cargo: "CMO",                    area: "Dirección",        tipoEmpleado: "DIRECTIVO", managerId: heads.direccion,    fechaIngreso: date(2021,2,1),  legajo: "D-005" },

  // ── Ventas (20) ─────────────────────────────────────────────────────────────
  { _id: heads.ventas,          nombre: "Marcela",   apellido: "Torres",     email: "mtorres@corp.com",      cargo: "Gerente Comercial",      area: "Ventas",           tipoEmpleado: "DIRECTIVO", managerId: heads.direccion,    fechaIngreso: date(2020,4,1),  legajo: "V-001" },
  { _id: oid(),                 nombre: "Diego",     apellido: "Suárez",     email: "dsuarez@corp.com",      cargo: "Team Lead Ventas",       area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2021,1,15), legajo: "V-002" },
  { _id: oid(),                 nombre: "Florencia", apellido: "Aguirre",    email: "faguirre@corp.com",     cargo: "Account Executive Sr",   area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2021,3,1),  legajo: "V-003" },
  { _id: oid(),                 nombre: "Nicolás",   apellido: "Herrera",    email: "nherrera@corp.com",     cargo: "Account Executive Sr",   area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2021,6,1),  legajo: "V-004" },
  { _id: oid(),                 nombre: "Carolina",  apellido: "Medina",     email: "cmedina@corp.com",      cargo: "Account Executive",      area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2022,1,10), legajo: "V-005" },
  { _id: oid(),                 nombre: "Tomás",     apellido: "Blanco",     email: "tblanco@corp.com",      cargo: "Account Executive",      area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2022,3,1),  legajo: "V-006" },
  { _id: oid(),                 nombre: "Agustina",  apellido: "Molina",     email: "amolina@corp.com",      cargo: "Account Executive",      area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2022,6,1),  legajo: "V-007" },
  { _id: oid(),                 nombre: "Ezequiel",  apellido: "Ruiz",       email: "eruiz@corp.com",        cargo: "SDR Sr",                 area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2022,8,1),  legajo: "V-008" },
  { _id: oid(),                 nombre: "Camila",    apellido: "Acosta",     email: "cacosta@corp.com",      cargo: "SDR Sr",                 area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2023,1,15), legajo: "V-009" },
  { _id: oid(),                 nombre: "Mateo",     apellido: "Ortega",     email: "mortega@corp.com",      cargo: "SDR",                    area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2023,3,1),  legajo: "V-010" },
  { _id: oid(),                 nombre: "Josefina",  apellido: "Vargas",     email: "jvargas@corp.com",      cargo: "SDR",                    area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2023,5,1),  legajo: "V-011" },
  { _id: oid(),                 nombre: "Bruno",     apellido: "Soto",       email: "bsoto@corp.com",        cargo: "SDR",                    area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2023,7,1),  legajo: "V-012" },
  { _id: oid(),                 nombre: "Valentín",  apellido: "Romero",     email: "vromero@corp.com",      cargo: "Inside Sales",           area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2023,9,1),  legajo: "V-013" },
  { _id: oid(),                 nombre: "Sofía",     apellido: "Ponce",      email: "sponce@corp.com",       cargo: "Inside Sales",           area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2024,1,10), legajo: "V-014" },
  { _id: oid(),                 nombre: "Ignacio",   apellido: "Reyes",      email: "ireyes@corp.com",       cargo: "Inside Sales",           area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2024,3,1),  legajo: "V-015" },
  { _id: oid(),                 nombre: "Lucía",     apellido: "Navarro",    email: "lnavarro@corp.com",     cargo: "Sales Analyst",          area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2024,5,1),  legajo: "V-016" },
  { _id: oid(),                 nombre: "Facundo",   apellido: "Espinoza",   email: "fespinoza@corp.com",    cargo: "Sales Analyst",          area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2024,7,1),  legajo: "V-017" },
  { _id: oid(),                 nombre: "Rocío",     apellido: "Peralta",    email: "rperalta@corp.com",     cargo: "Sales Ops",              area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2024,9,1),  legajo: "V-018" },
  { _id: oid(),                 nombre: "Santiago",  apellido: "Delgado",    email: "sdelgado@corp.com",     cargo: "Sales Ops",              area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2025,1,15), legajo: "V-019" },
  { _id: oid(),                 nombre: "Milagros",  apellido: "Cardozo",    email: "mcardozo@corp.com",     cargo: "SDR Jr",                 area: "Ventas",           tipoEmpleado: "OTRO",      managerId: heads.ventas,       fechaIngreso: date(2025,3,1),  legajo: "V-020" },

  // ── Marketing (12) ──────────────────────────────────────────────────────────
  { _id: heads.marketing,       nombre: "Daniela",   apellido: "Fuentes",    email: "dfuentes@corp.com",     cargo: "Gerente de Marketing",   area: "Marketing",        tipoEmpleado: "DIRECTIVO", managerId: heads.direccion,    fechaIngreso: date(2020,6,1),  legajo: "M-001" },
  { _id: oid(),                 nombre: "Patricio",  apellido: "Guerrero",   email: "pguerrero@corp.com",    cargo: "Content Manager",        area: "Marketing",        tipoEmpleado: "OTRO",      managerId: heads.marketing,    fechaIngreso: date(2021,2,1),  legajo: "M-002" },
  { _id: oid(),                 nombre: "Emilia",    apellido: "Bravo",      email: "ebravo@corp.com",       cargo: "SEO & SEM Lead",         area: "Marketing",        tipoEmpleado: "OTRO",      managerId: heads.marketing,    fechaIngreso: date(2021,5,1),  legajo: "M-003" },
  { _id: oid(),                 nombre: "Maximiliano",apellido:"Ibáñez",     email: "mibanez@corp.com",      cargo: "Growth Hacker",          area: "Marketing",        tipoEmpleado: "OTRO",      managerId: heads.marketing,    fechaIngreso: date(2022,1,10), legajo: "M-004" },
  { _id: oid(),                 nombre: "Pilar",     apellido: "Rojas",      email: "projas@corp.com",       cargo: "Community Manager",      area: "Marketing",        tipoEmpleado: "OTRO",      managerId: heads.marketing,    fechaIngreso: date(2022,4,1),  legajo: "M-005" },
  { _id: oid(),                 nombre: "Leandro",   apellido: "Salas",      email: "lsalas@corp.com",       cargo: "Diseñador Gráfico Sr",   area: "Marketing",        tipoEmpleado: "OTRO",      managerId: heads.marketing,    fechaIngreso: date(2022,7,1),  legajo: "M-006" },
  { _id: oid(),                 nombre: "Valeria",   apellido: "Cuevas",     email: "vcuevas@corp.com",      cargo: "Diseñadora UX/UI",       area: "Marketing",        tipoEmpleado: "OTRO",      managerId: heads.marketing,    fechaIngreso: date(2023,1,15), legajo: "M-007" },
  { _id: oid(),                 nombre: "Hernán",    apellido: "Miranda",    email: "hmiranda@corp.com",     cargo: "Email Marketing Spec",   area: "Marketing",        tipoEmpleado: "OTRO",      managerId: heads.marketing,    fechaIngreso: date(2023,4,1),  legajo: "M-008" },
  { _id: oid(),                 nombre: "Natalia",   apellido: "Cabrera",    email: "ncabrera@corp.com",     cargo: "Social Media",           area: "Marketing",        tipoEmpleado: "OTRO",      managerId: heads.marketing,    fechaIngreso: date(2023,8,1),  legajo: "M-009" },
  { _id: oid(),                 nombre: "Andrés",    apellido: "Benítez",    email: "abenitez@corp.com",     cargo: "Paid Media Specialist",  area: "Marketing",        tipoEmpleado: "OTRO",      managerId: heads.marketing,    fechaIngreso: date(2024,1,10), legajo: "M-010" },
  { _id: oid(),                 nombre: "Celeste",   apellido: "Ramos",      email: "cramos@corp.com",       cargo: "Marketing Analyst",      area: "Marketing",        tipoEmpleado: "OTRO",      managerId: heads.marketing,    fechaIngreso: date(2024,5,1),  legajo: "M-011" },
  { _id: oid(),                 nombre: "Gonzalo",   apellido: "Núñez",      email: "gnunez@corp.com",       cargo: "Video & Motion",         area: "Marketing",        tipoEmpleado: "OTRO",      managerId: heads.marketing,    fechaIngreso: date(2024,9,1),  legajo: "M-012" },

  // ── Producto (12) ────────────────────────────────────────────────────────────
  { _id: heads.producto,        nombre: "Jimena",    apellido: "Lara",       email: "jlara@corp.com",        cargo: "VP of Product",          area: "Producto",         tipoEmpleado: "DIRECTIVO", managerId: heads.direccion,    fechaIngreso: date(2020,8,1),  legajo: "P-001" },
  { _id: oid(),                 nombre: "Ariel",     apellido: "Álvarez",    email: "aalvarez@corp.com",     cargo: "Product Manager Sr",     area: "Producto",         tipoEmpleado: "OTRO",      managerId: heads.producto,     fechaIngreso: date(2021,3,1),  legajo: "P-002" },
  { _id: oid(),                 nombre: "Belén",     apellido: "Ojeda",      email: "bojeda@corp.com",       cargo: "Product Manager",        area: "Producto",         tipoEmpleado: "OTRO",      managerId: heads.producto,     fechaIngreso: date(2022,1,15), legajo: "P-003" },
  { _id: oid(),                 nombre: "Damián",    apellido: "Peña",       email: "dpena@corp.com",        cargo: "Product Manager",        area: "Producto",         tipoEmpleado: "OTRO",      managerId: heads.producto,     fechaIngreso: date(2022,5,1),  legajo: "P-004" },
  { _id: oid(),                 nombre: "Gisela",    apellido: "Contreras",  email: "gcontreras@corp.com",   cargo: "UX Researcher",          area: "Producto",         tipoEmpleado: "OTRO",      managerId: heads.producto,     fechaIngreso: date(2022,9,1),  legajo: "P-005" },
  { _id: oid(),                 nombre: "Mauricio",  apellido: "Valdez",     email: "mvaldez@corp.com",      cargo: "UX Designer Sr",         area: "Producto",         tipoEmpleado: "OTRO",      managerId: heads.producto,     fechaIngreso: date(2023,1,10), legajo: "P-006" },
  { _id: oid(),                 nombre: "Silvana",   apellido: "Giménez",    email: "sgimenez@corp.com",     cargo: "UX Designer",            area: "Producto",         tipoEmpleado: "OTRO",      managerId: heads.producto,     fechaIngreso: date(2023,4,1),  legajo: "P-007" },
  { _id: oid(),                 nombre: "Claudio",   apellido: "Flores",     email: "cflores@corp.com",      cargo: "Business Analyst",       area: "Producto",         tipoEmpleado: "OTRO",      managerId: heads.producto,     fechaIngreso: date(2023,7,1),  legajo: "P-008" },
  { _id: oid(),                 nombre: "Mariana",   apellido: "Bustos",     email: "mbustos@corp.com",      cargo: "Business Analyst",       area: "Producto",         tipoEmpleado: "OTRO",      managerId: heads.producto,     fechaIngreso: date(2024,1,15), legajo: "P-009" },
  { _id: oid(),                 nombre: "Pablo",     apellido: "Sandoval",   email: "psandoval@corp.com",    cargo: "Scrum Master",           area: "Producto",         tipoEmpleado: "OTRO",      managerId: heads.producto,     fechaIngreso: date(2024,4,1),  legajo: "P-010" },
  { _id: oid(),                 nombre: "Karina",    apellido: "Villareal",  email: "kvillareal@corp.com",   cargo: "Product Analyst",        area: "Producto",         tipoEmpleado: "OTRO",      managerId: heads.producto,     fechaIngreso: date(2024,8,1),  legajo: "P-011" },
  { _id: oid(),                 nombre: "Iván",      apellido: "Campos",     email: "icampos@corp.com",      cargo: "Product Analyst Jr",     area: "Producto",         tipoEmpleado: "OTRO",      managerId: heads.producto,     fechaIngreso: date(2025,1,15), legajo: "P-012" },

  // ── Tecnología (18) ─────────────────────────────────────────────────────────
  { _id: heads.tecnologia,      nombre: "Luciano",   apellido: "Mendoza",    email: "lmendoza@corp.com",     cargo: "Engineering Manager",    area: "Tecnología",       tipoEmpleado: "DIRECTIVO", managerId: heads.direccion,    fechaIngreso: date(2020,5,1),  legajo: "T-001" },
  { _id: oid(),                 nombre: "Verónica",  apellido: "Solís",      email: "vsolis@corp.com",       cargo: "Tech Lead Backend",      area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2021,2,1),  legajo: "T-002" },
  { _id: oid(),                 nombre: "Fernando",  apellido: "Quiroga",    email: "fquiroga@corp.com",     cargo: "Tech Lead Frontend",     area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2021,5,1),  legajo: "T-003" },
  { _id: oid(),                 nombre: "Nadia",     apellido: "Ávila",      email: "navila@corp.com",       cargo: "Senior Backend Dev",     area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2021,8,1),  legajo: "T-004" },
  { _id: oid(),                 nombre: "Roberto",   apellido: "Escobar",    email: "rescobar@corp.com",     cargo: "Senior Backend Dev",     area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2022,1,15), legajo: "T-005" },
  { _id: oid(),                 nombre: "Tatiana",   apellido: "Pinto",      email: "tpinto@corp.com",       cargo: "Senior Frontend Dev",    area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2022,4,1),  legajo: "T-006" },
  { _id: oid(),                 nombre: "Ezequiel",  apellido: "Barrios",    email: "ebarrios@corp.com",     cargo: "Senior Frontend Dev",    area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2022,7,1),  legajo: "T-007" },
  { _id: oid(),                 nombre: "Lorena",    apellido: "Serrano",    email: "lserrano@corp.com",     cargo: "Full Stack Developer",   area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2022,10,1), legajo: "T-008" },
  { _id: oid(),                 nombre: "Oscar",     apellido: "Paredes",    email: "oparedes@corp.com",     cargo: "Full Stack Developer",   area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2023,1,10), legajo: "T-009" },
  { _id: oid(),                 nombre: "Viviana",   apellido: "Cisneros",   email: "vcisneros@corp.com",    cargo: "DevOps Engineer",        area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2023,3,1),  legajo: "T-010" },
  { _id: oid(),                 nombre: "Hugo",      apellido: "Vásquez",    email: "hvasquez@corp.com",     cargo: "DevOps Engineer",        area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2023,6,1),  legajo: "T-011" },
  { _id: oid(),                 nombre: "Marina",    apellido: "Tapia",      email: "mtapia@corp.com",       cargo: "QA Engineer",            area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2023,9,1),  legajo: "T-012" },
  { _id: oid(),                 nombre: "Álvaro",    apellido: "Cabral",     email: "acabral@corp.com",      cargo: "QA Engineer",            area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2024,1,15), legajo: "T-013" },
  { _id: oid(),                 nombre: "Fátima",    apellido: "Leiva",      email: "fleiva@corp.com",       cargo: "Data Engineer",          area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2024,4,1),  legajo: "T-014" },
  { _id: oid(),                 nombre: "Agustín",   apellido: "Mora",       email: "amora@corp.com",        cargo: "Backend Developer",      area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2024,7,1),  legajo: "T-015" },
  { _id: oid(),                 nombre: "Soledad",   apellido: "Pedraza",    email: "spedraza@corp.com",     cargo: "Frontend Developer",     area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2024,10,1), legajo: "T-016" },
  { _id: oid(),                 nombre: "Reinaldo",  apellido: "Salinas",    email: "rsalinas@corp.com",     cargo: "Developer Jr",           area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2025,1,15), legajo: "T-017" },
  { _id: oid(),                 nombre: "Brenda",    apellido: "Quintana",   email: "bquintana@corp.com",    cargo: "Developer Jr",           area: "Tecnología",       tipoEmpleado: "OTRO",      managerId: heads.tecnologia,   fechaIngreso: date(2025,3,1),  legajo: "T-018" },

  // ── Operaciones (12) ────────────────────────────────────────────────────────
  { _id: heads.operaciones,     nombre: "Gustavo",   apellido: "Zamora",     email: "gzamora@corp.com",      cargo: "Gerente de Operaciones", area: "Operaciones",      tipoEmpleado: "DIRECTIVO", managerId: heads.direccion,    fechaIngreso: date(2020,7,1),  legajo: "O-001" },
  { _id: oid(),                 nombre: "Elena",     apellido: "Pacheco",    email: "epacheco@corp.com",     cargo: "Operations Manager",     area: "Operaciones",      tipoEmpleado: "OTRO",      managerId: heads.operaciones,  fechaIngreso: date(2021,4,1),  legajo: "O-002" },
  { _id: oid(),                 nombre: "Claudio",   apellido: "Aranda",     email: "caranda@corp.com",      cargo: "Analista de Procesos",   area: "Operaciones",      tipoEmpleado: "OTRO",      managerId: heads.operaciones,  fechaIngreso: date(2021,8,1),  legajo: "O-003" },
  { _id: oid(),                 nombre: "Miriam",    apellido: "Figueroa",   email: "mfigueroa@corp.com",    cargo: "Analista de Procesos",   area: "Operaciones",      tipoEmpleado: "OTRO",      managerId: heads.operaciones,  fechaIngreso: date(2022,2,1),  legajo: "O-004" },
  { _id: oid(),                 nombre: "Walter",    apellido: "Córdoba",    email: "wcordoba@corp.com",     cargo: "Supply Chain Analyst",   area: "Operaciones",      tipoEmpleado: "OTRO",      managerId: heads.operaciones,  fechaIngreso: date(2022,6,1),  legajo: "O-005" },
  { _id: oid(),                 nombre: "Patricia",  apellido: "Lozano",     email: "plozano@corp.com",      cargo: "Project Coordinator",    area: "Operaciones",      tipoEmpleado: "OTRO",      managerId: heads.operaciones,  fechaIngreso: date(2022,10,1), legajo: "O-006" },
  { _id: oid(),                 nombre: "Rafael",    apellido: "Ríos",       email: "rrios@corp.com",        cargo: "Project Coordinator",    area: "Operaciones",      tipoEmpleado: "OTRO",      managerId: heads.operaciones,  fechaIngreso: date(2023,2,1),  legajo: "O-007" },
  { _id: oid(),                 nombre: "Liliana",   apellido: "Palacios",   email: "lpalacios@corp.com",    cargo: "Analista Operativo",     area: "Operaciones",      tipoEmpleado: "OTRO",      managerId: heads.operaciones,  fechaIngreso: date(2023,6,1),  legajo: "O-008" },
  { _id: oid(),                 nombre: "Nelson",    apellido: "Rivas",      email: "nrivas@corp.com",       cargo: "Analista Operativo",     area: "Operaciones",      tipoEmpleado: "OTRO",      managerId: heads.operaciones,  fechaIngreso: date(2023,10,1), legajo: "O-009" },
  { _id: oid(),                 nombre: "Sabrina",   apellido: "Herrera",    email: "sherrera@corp.com",     cargo: "Logistics Coordinator",  area: "Operaciones",      tipoEmpleado: "OTRO",      managerId: heads.operaciones,  fechaIngreso: date(2024,2,1),  legajo: "O-010" },
  { _id: oid(),                 nombre: "Cristian",  apellido: "Moran",      email: "cmoran@corp.com",       cargo: "Logistics Coordinator",  area: "Operaciones",      tipoEmpleado: "OTRO",      managerId: heads.operaciones,  fechaIngreso: date(2024,6,1),  legajo: "O-011" },
  { _id: oid(),                 nombre: "Laura",     apellido: "Osorio",     email: "losorio@corp.com",      cargo: "Ops Analyst Jr",         area: "Operaciones",      tipoEmpleado: "OTRO",      managerId: heads.operaciones,  fechaIngreso: date(2025,1,15), legajo: "O-012" },

  // ── Finanzas (10) ───────────────────────────────────────────────────────────
  { _id: heads.finanzas,        nombre: "Ricardo",   apellido: "Gómez",      email: "rgomez@corp.com",       cargo: "Gerente de Finanzas",    area: "Finanzas",         tipoEmpleado: "DIRECTIVO", managerId: heads.direccion,    fechaIngreso: date(2020,9,1),  legajo: "F-001" },
  { _id: oid(),                 nombre: "Silvia",    apellido: "Carrillo",   email: "scarrillo@corp.com",    cargo: "Contadora Sr",           area: "Finanzas",         tipoEmpleado: "OTRO",      managerId: heads.finanzas,     fechaIngreso: date(2021,3,1),  legajo: "F-002" },
  { _id: oid(),                 nombre: "Jorge",     apellido: "Montoya",    email: "jmontoya@corp.com",     cargo: "Analista Financiero Sr", area: "Finanzas",         tipoEmpleado: "OTRO",      managerId: heads.finanzas,     fechaIngreso: date(2021,7,1),  legajo: "F-003" },
  { _id: oid(),                 nombre: "Ana",       apellido: "Duarte",     email: "aduarte@corp.com",      cargo: "Analista Financiero",    area: "Finanzas",         tipoEmpleado: "OTRO",      managerId: heads.finanzas,     fechaIngreso: date(2022,2,1),  legajo: "F-004" },
  { _id: oid(),                 nombre: "Marcos",    apellido: "Vergara",    email: "mvergara@corp.com",     cargo: "Analista Financiero",    area: "Finanzas",         tipoEmpleado: "OTRO",      managerId: heads.finanzas,     fechaIngreso: date(2022,6,1),  legajo: "F-005" },
  { _id: oid(),                 nombre: "Yolanda",   apellido: "Montes",     email: "ymontes@corp.com",      cargo: "Tesorería",              area: "Finanzas",         tipoEmpleado: "OTRO",      managerId: heads.finanzas,     fechaIngreso: date(2022,10,1), legajo: "F-006" },
  { _id: oid(),                 nombre: "César",     apellido: "Ibarra",     email: "cibarra@corp.com",      cargo: "Controlling",            area: "Finanzas",         tipoEmpleado: "OTRO",      managerId: heads.finanzas,     fechaIngreso: date(2023,3,1),  legajo: "F-007" },
  { _id: oid(),                 nombre: "Gabriela",  apellido: "Moya",       email: "gmoya@corp.com",        cargo: "Auditor Interno",        area: "Finanzas",         tipoEmpleado: "OTRO",      managerId: heads.finanzas,     fechaIngreso: date(2023,7,1),  legajo: "F-008" },
  { _id: oid(),                 nombre: "Héctor",    apellido: "Polo",       email: "hpolo@corp.com",        cargo: "FP&A Analyst",           area: "Finanzas",         tipoEmpleado: "OTRO",      managerId: heads.finanzas,     fechaIngreso: date(2024,1,15), legajo: "F-009" },
  { _id: oid(),                 nombre: "Paola",     apellido: "Vidal",      email: "pvidal@corp.com",       cargo: "Contadora Jr",           area: "Finanzas",         tipoEmpleado: "OTRO",      managerId: heads.finanzas,     fechaIngreso: date(2024,6,1),  legajo: "F-010" },

  // ── RRHH (8) ────────────────────────────────────────────────────────────────
  { _id: heads.rrhh,            nombre: "Claudia",   apellido: "Muñoz",      email: "cmunoz@corp.com",       cargo: "Gerente de RRHH",        area: "RRHH",             tipoEmpleado: "RRHH",      managerId: heads.direccion,    fechaIngreso: date(2020,4,1),  legajo: "R-001" },
  { _id: oid(),                 nombre: "Sebastián", apellido: "Cano",       email: "scano@corp.com",        cargo: "HRBP Sr",                area: "RRHH",             tipoEmpleado: "RRHH",      managerId: heads.rrhh,         fechaIngreso: date(2021,2,1),  legajo: "R-002" },
  { _id: oid(),                 nombre: "Vanesa",    apellido: "Rosales",    email: "vrosales@corp.com",     cargo: "HRBP",                   area: "RRHH",             tipoEmpleado: "RRHH",      managerId: heads.rrhh,         fechaIngreso: date(2022,1,15), legajo: "R-003" },
  { _id: oid(),                 nombre: "Esteban",   apellido: "Luna",       email: "eluna@corp.com",        cargo: "Talent Acquisition",     area: "RRHH",             tipoEmpleado: "RRHH",      managerId: heads.rrhh,         fechaIngreso: date(2022,5,1),  legajo: "R-004" },
  { _id: oid(),                 nombre: "Cecilia",   apellido: "Zúñiga",     email: "czuniga@corp.com",      cargo: "Talent Acquisition",     area: "RRHH",             tipoEmpleado: "RRHH",      managerId: heads.rrhh,         fechaIngreso: date(2023,1,10), legajo: "R-005" },
  { _id: oid(),                 nombre: "Tomás",     apellido: "Fuentes",    email: "tfuentes@corp.com",     cargo: "L&D Specialist",         area: "RRHH",             tipoEmpleado: "RRHH",      managerId: heads.rrhh,         fechaIngreso: date(2023,5,1),  legajo: "R-006" },
  { _id: oid(),                 nombre: "Beatriz",   apellido: "Alvarado",   email: "balvarado@corp.com",    cargo: "People Ops",             area: "RRHH",             tipoEmpleado: "RRHH",      managerId: heads.rrhh,         fechaIngreso: date(2024,1,15), legajo: "R-007" },
  { _id: oid(),                 nombre: "Alexis",    apellido: "Tejada",     email: "atejada@corp.com",      cargo: "People Ops Jr",          area: "RRHH",             tipoEmpleado: "RRHH",      managerId: heads.rrhh,         fechaIngreso: date(2025,1,15), legajo: "R-008" },

  // ── Customer Success (12) ───────────────────────────────────────────────────
  { _id: heads.customerSuccess, nombre: "Mónica",    apellido: "Espejo",     email: "mespejo@corp.com",      cargo: "Head of CS",             area: "Customer Success", tipoEmpleado: "DIRECTIVO", managerId: heads.direccion,    fechaIngreso: date(2020,10,1), legajo: "CS-001" },
  { _id: oid(),                 nombre: "Adrián",    apellido: "Salcedo",    email: "asalcedo@corp.com",     cargo: "CS Manager",             area: "Customer Success", tipoEmpleado: "OTRO",      managerId: heads.customerSuccess, fechaIngreso: date(2021,3,1), legajo: "CS-002" },
  { _id: oid(),                 nombre: "Renata",    apellido: "Bernal",     email: "rbernal@corp.com",      cargo: "CSM Sr",                 area: "Customer Success", tipoEmpleado: "OTRO",      managerId: heads.customerSuccess, fechaIngreso: date(2021,7,1), legajo: "CS-003" },
  { _id: oid(),                 nombre: "Kevin",     apellido: "Rosario",    email: "krosario@corp.com",     cargo: "CSM Sr",                 area: "Customer Success", tipoEmpleado: "OTRO",      managerId: heads.customerSuccess, fechaIngreso: date(2022,1,15),legajo: "CS-004" },
  { _id: oid(),                 nombre: "Ximena",    apellido: "Delgado",    email: "xdelgado@corp.com",     cargo: "CSM",                    area: "Customer Success", tipoEmpleado: "OTRO",      managerId: heads.customerSuccess, fechaIngreso: date(2022,5,1), legajo: "CS-005" },
  { _id: oid(),                 nombre: "Rodrigo",   apellido: "Cordero",    email: "rcordero@corp.com",     cargo: "CSM",                    area: "Customer Success", tipoEmpleado: "OTRO",      managerId: heads.customerSuccess, fechaIngreso: date(2022,9,1), legajo: "CS-006" },
  { _id: oid(),                 nombre: "Priscila",  apellido: "Rocha",      email: "procha@corp.com",       cargo: "CSM",                    area: "Customer Success", tipoEmpleado: "OTRO",      managerId: heads.customerSuccess, fechaIngreso: date(2023,2,1), legajo: "CS-007" },
  { _id: oid(),                 nombre: "Julián",    apellido: "Alcántara",  email: "jalcantara@corp.com",   cargo: "Onboarding Specialist",  area: "Customer Success", tipoEmpleado: "OTRO",      managerId: heads.customerSuccess, fechaIngreso: date(2023,6,1), legajo: "CS-008" },
  { _id: oid(),                 nombre: "Noemí",     apellido: "Cortez",     email: "ncortez@corp.com",      cargo: "Support Specialist Sr",  area: "Customer Success", tipoEmpleado: "OTRO",      managerId: heads.customerSuccess, fechaIngreso: date(2023,10,1),legajo: "CS-009" },
  { _id: oid(),                 nombre: "Alberto",   apellido: "Villanueva", email: "avillanueva@corp.com",  cargo: "Support Specialist",     area: "Customer Success", tipoEmpleado: "OTRO",      managerId: heads.customerSuccess, fechaIngreso: date(2024,3,1), legajo: "CS-010" },
  { _id: oid(),                 nombre: "Isidora",   apellido: "Céspedes",   email: "icespedes@corp.com",    cargo: "Support Specialist",     area: "Customer Success", tipoEmpleado: "OTRO",      managerId: heads.customerSuccess, fechaIngreso: date(2024,7,1), legajo: "CS-011" },
  { _id: oid(),                 nombre: "Emilio",    apellido: "Gutiérrez",  email: "egutierrez@corp.com",   cargo: "CS Analyst Jr",          area: "Customer Success", tipoEmpleado: "OTRO",      managerId: heads.customerSuccess, fechaIngreso: date(2025,2,1), legajo: "CS-012" },

  // ── Legal (5) ───────────────────────────────────────────────────────────────
  { _id: heads.legal,           nombre: "Gonzalo",   apellido: "Restrepo",   email: "grestrepo@corp.com",    cargo: "General Counsel",        area: "Legal",            tipoEmpleado: "DIRECTIVO", managerId: heads.direccion,    fechaIngreso: date(2021,1,1),  legajo: "L-001" },
  { _id: oid(),                 nombre: "Daniela",   apellido: "Pedrosa",    email: "dpedrosa@corp.com",     cargo: "Abogada Corporativa Sr", area: "Legal",            tipoEmpleado: "OTRO",      managerId: heads.legal,        fechaIngreso: date(2021,6,1),  legajo: "L-002" },
  { _id: oid(),                 nombre: "Alejandro", apellido: "Trujillo",   email: "atrujillo@corp.com",    cargo: "Abogado Laboral",        area: "Legal",            tipoEmpleado: "OTRO",      managerId: heads.legal,        fechaIngreso: date(2022,3,1),  legajo: "L-003" },
  { _id: oid(),                 nombre: "Susana",    apellido: "Cuéllar",    email: "scuellar@corp.com",     cargo: "Compliance Officer",     area: "Legal",            tipoEmpleado: "OTRO",      managerId: heads.legal,        fechaIngreso: date(2023,1,15), legajo: "L-004" },
  { _id: oid(),                 nombre: "Mauricio",  apellido: "Oquendo",    email: "moquendo@corp.com",     cargo: "Paralegal",              area: "Legal",            tipoEmpleado: "OTRO",      managerId: heads.legal,        fechaIngreso: date(2024,3,1),  legajo: "L-005" },
];

// Add common fields to all employees
const now = new Date();
const empDocs = employees.map((e) => ({
  ...e,
  companyId,
  schoolId,
  activo: true,
  createdAt: now,
  updatedAt: now,
}));

await db.collection("employees").insertMany(empDocs);
console.log(`Inserted ${empDocs.length} employees.`);

// ─── Competencias por área ────────────────────────────────────────────────────
const competencies = [
  // Transversales (todas las áreas)
  { nombre: "Comunicación efectiva",       tipo: "TRANSVERSAL", componente: "H", descripcion: "Capacidad para transmitir ideas con claridad y escuchar activamente." },
  { nombre: "Trabajo en equipo",           tipo: "TRANSVERSAL", componente: "A", descripcion: "Colaboración, apoyo mutuo y sinergia con colegas." },
  { nombre: "Orientación a resultados",    tipo: "TRANSVERSAL", componente: "A", descripcion: "Foco en el cumplimiento de objetivos con calidad." },
  { nombre: "Adaptabilidad al cambio",     tipo: "TRANSVERSAL", componente: "A", descripcion: "Flexibilidad ante nuevas situaciones y entornos cambiantes." },
  { nombre: "Proactividad",                tipo: "TRANSVERSAL", componente: "A", descripcion: "Iniciativa para anticiparse y proponer soluciones." },
  // Liderazgo
  { nombre: "Liderazgo de equipos",        tipo: "LIDERAZGO",   componente: "A", descripcion: "Capacidad para guiar, motivar y desarrollar personas." },
  { nombre: "Toma de decisiones",          tipo: "LIDERAZGO",   componente: "C", descripcion: "Análisis y criterio para elegir el mejor curso de acción." },
  { nombre: "Gestión del cambio",          tipo: "LIDERAZGO",   componente: "A", descripcion: "Conducción de procesos de transformación organizacional." },
  { nombre: "Pensamiento estratégico",     tipo: "LIDERAZGO",   componente: "C", descripcion: "Visión de largo plazo alineada a los objetivos del negocio." },
  // Ventas
  { nombre: "Negociación y cierre",        tipo: "TECNICA",     componente: "H", descripcion: "Habilidad para conducir negociaciones y concretar acuerdos." },
  { nombre: "Gestión del pipeline",        tipo: "TECNICA",     componente: "C", descripcion: "Administración del embudo de ventas con metodología." },
  { nombre: "Prospección activa",          tipo: "TECNICA",     componente: "H", descripcion: "Capacidad para identificar y calificar nuevas oportunidades." },
  // Tecnología
  { nombre: "Calidad del código",          tipo: "TECNICA",     componente: "C", descripcion: "Producción de código limpio, testeable y bien documentado." },
  { nombre: "Resolución de problemas técnicos", tipo: "TECNICA",componente: "C", descripcion: "Diagnóstico y solución eficiente de bugs e incidentes." },
  { nombre: "Ownership técnico",           tipo: "TECNICA",     componente: "A", descripcion: "Responsabilidad sobre la calidad y entrega del producto técnico." },
  // Producto
  { nombre: "Customer centricity",         tipo: "TECNICA",     componente: "A", descripcion: "Comprensión profunda del usuario para diseñar mejores soluciones." },
  { nombre: "Priorización de backlog",     tipo: "TECNICA",     componente: "C", descripcion: "Gestión del roadmap con criterio de valor y esfuerzo." },
  // Customer Success
  { nombre: "Retención y expansión",       tipo: "TECNICA",     componente: "H", descripcion: "Capacidad para reducir churn e identificar oportunidades de expansión." },
  { nombre: "Gestión de escalaciones",     tipo: "TECNICA",     componente: "H", descripcion: "Resolución de problemas críticos de clientes con agilidad." },
];

const compDocs = competencies.map((c) => ({
  ...c,
  companyId,
  schoolId,
  activa: true,
  createdAt: now,
  updatedAt: now,
}));
await db.collection("competencies").insertMany(compDocs);
console.log(`Inserted ${compDocs.length} competencies.`);

// ─── Ciclos de evaluación ─────────────────────────────────────────────────────
const cycles = [
  { anio: 2024, periodo: "Q2 2024", etapa: "FIN",    estado: "CERRADO",  fechaInicio: date(2024,4,1),  fechaFin: date(2024,6,30) },
  { anio: 2024, periodo: "Q4 2024", etapa: "FIN",    estado: "CERRADO",  fechaInicio: date(2024,10,1), fechaFin: date(2024,12,31) },
  { anio: 2025, periodo: "Q2 2025", etapa: "FIN",    estado: "CERRADO",  fechaInicio: date(2025,4,1),  fechaFin: date(2025,6,30) },
  { anio: 2025, periodo: "Q4 2025", etapa: "FIN",    estado: "CERRADO",  fechaInicio: date(2025,10,1), fechaFin: date(2025,12,31) },
  { anio: 2026, periodo: "Q2 2026", etapa: "INICIO", estado: "ABIERTO",  fechaInicio: date(2026,4,1),  fechaFin: date(2026,6,30) },
];

const cycleDocs = cycles.map((c) => ({ ...c, companyId, schoolId, createdAt: now, updatedAt: now }));
const cycleResult = await db.collection("evaluationcycles").insertMany(cycleDocs);
console.log(`Inserted ${cycles.length} evaluation cycles.`);

// ─── Summary ─────────────────────────────────────────────────────────────────
const byArea = {};
for (const e of empDocs) byArea[e.area] = (byArea[e.area] || 0) + 1;
console.log("\n=== ZENTOR Corp S.A. — Demo seed complete ===");
for (const [area, count] of Object.entries(byArea)) {
  console.log(`  ${area.padEnd(20)} ${count} empleados`);
}
console.log(`  ${"TOTAL".padEnd(20)} ${empDocs.length} empleados`);
console.log(`  ${compDocs.length} competencias · ${cycles.length} ciclos`);
console.log("\ncompanyId:", companyId.toString());
console.log("schoolId: ", schoolId.toString());

process.exit(0);
