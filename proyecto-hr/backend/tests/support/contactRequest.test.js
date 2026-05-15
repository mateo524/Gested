import test from "node:test";
import assert from "node:assert/strict";
import {
  CONTACT_MESSAGE_MAX_LENGTH,
  normalizeContactPayload,
  validateContactPayload,
} from "../../routes/support.routes.js";

test("normaliza payload de landing con aliases en espanol", () => {
  const normalized = normalizeContactPayload({
    nombre: " Ana Perez ",
    email: "ANA@MAIL.COM ",
    institucion: " Colegio Norte ",
    rol: "Directora",
    tamanio: "50-100",
    mensaje: " Quiero una demo ",
    source: "Contacto",
  });

  assert.deepEqual(normalized, {
    name: "Ana Perez",
    email: "ana@mail.com",
    institution: "Colegio Norte",
    role: "Directora",
    size: "50-100",
    message: "Quiero una demo",
    source: "contacto",
  });
});

test("rechaza nombre y email faltantes", () => {
  const result = validateContactPayload({
    name: "",
    email: "",
    institution: "",
    role: "",
    size: "",
    message: "",
    source: "landing",
  });

  assert.equal(result.ok, false);
  assert.match(result.fieldErrors.name, /nombre/i);
  assert.match(result.fieldErrors.email, /email/i);
});

test("rechaza email invalido", () => {
  const result = validateContactPayload({
    name: "Ana",
    email: "correo-invalido",
    institution: "",
    role: "",
    size: "",
    message: "",
    source: "landing",
  });

  assert.equal(result.ok, false);
  assert.match(result.fieldErrors.email, /valido/i);
});

test("rechaza mensaje demasiado largo", () => {
  const result = validateContactPayload({
    name: "Ana",
    email: "ana@mail.com",
    institution: "",
    role: "",
    size: "",
    message: "x".repeat(CONTACT_MESSAGE_MAX_LENGTH + 1),
    source: "landing",
  });

  assert.equal(result.ok, false);
  assert.match(result.fieldErrors.message, /2000/);
});
