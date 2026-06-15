import "dotenv/config";
import mongoose from "mongoose";
import Employee from "../models/Employee.js";
import Competency from "../models/Competency.js";
import EvaluationCycle from "../models/EvaluationCycle.js";

await mongoose.connect(process.env.MONGO_URI_DIRECT);
const db = mongoose.connection.db;

const companyId = new mongoose.Types.ObjectId("6a29b32aee3b9f7a50c3042b");

// Clean up any partial previous seed
await db.collection("employees").deleteMany({ companyId });
await db.collection("competencies").deleteMany({ companyId });
await db.collection("evaluationcycles").deleteMany({ companyId });
await db.collection("schools").deleteMany({ companyId });

const schoolRes = await db.collection("schools").insertOne({
  companyId,
  nombre: "Institucion Demo",
  activa: true,
  createdAt: new Date(),
  updatedAt: new Date(),
});
const schoolId = schoolRes.insertedId;
console.log("School:", schoolId.toString());

await db.collection("users").updateOne(
  { email: "admin@demo.com" },
  { $set: { schoolId } }
);

await Employee.insertMany([
  { companyId, schoolId, nombre: "Laura",  apellido: "Gomez",     email: "lgomez@demo.com",     cargo: "Docente",        area: "Primaria",   tipoEmpleado: "DOCENTE" },
  { companyId, schoolId, nombre: "Martin", apellido: "Perez",     email: "mperez@demo.com",     cargo: "Coordinador",    area: "Secundaria", tipoEmpleado: "DIRECTIVO" },
  { companyId, schoolId, nombre: "Sofia",  apellido: "Lopez",     email: "slopez@demo.com",     cargo: "Profesora",      area: "Matematica", tipoEmpleado: "DOCENTE" },
  { companyId, schoolId, nombre: "Carlos", apellido: "Rodriguez", email: "crodriguez@demo.com", cargo: "Jefe de Area",   area: "Ciencias",   tipoEmpleado: "DIRECTIVO" },
  { companyId, schoolId, nombre: "Ana",    apellido: "Martinez",  email: "amartinez@demo.com",  cargo: "Administrativa", area: "Gestion",    tipoEmpleado: "NO_DOCENTE" },
]);

await Competency.insertMany([
  { companyId, schoolId, nombre: "Comunicacion efectiva",    descripcion: "Capacidad para transmitir ideas con claridad.",       tipo: "TRANSVERSAL", componente: "H", activa: true },
  { companyId, schoolId, nombre: "Trabajo en equipo",        descripcion: "Colaboracion y apoyo mutuo entre colegas.",           tipo: "TRANSVERSAL", componente: "A", activa: true },
  { companyId, schoolId, nombre: "Planificacion pedagogica", descripcion: "Diseno de clases y contenidos con objetivos claros.", tipo: "DOCENTE",     componente: "C", activa: true },
  { companyId, schoolId, nombre: "Liderazgo institucional",  descripcion: "Capacidad para guiar equipos hacia metas comunes.",   tipo: "LIDERAZGO",   componente: "A", activa: true },
]);

const now = new Date();
await EvaluationCycle.create({
  companyId, schoolId,
  anio: 2026, periodo: "Demo 2026", etapa: "INICIO", estado: "ABIERTO",
  fechaInicio: now,
  fechaFin: new Date(2026, 8, 30),
});

console.log("Seeded OK: 5 empleados, 4 competencias, 1 ciclo");
process.exit(0);
