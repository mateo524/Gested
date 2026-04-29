import PDFDocument from "pdfkit";
import fs from "fs";
import path from "path";

export function generateEmployeePDF(employee, stream) {
  const doc = new PDFDocument();

  // Escribir al stream
  doc.pipe(stream);

  // Estilos y variables
  const primaryColor = "#10b981";
  const secondaryColor = "#1f2937";
  const lightColor = "#f3f4f6";

  // Encabezado
  doc.fillColor(primaryColor);
  doc.fontSize(28).font("Helvetica-Bold").text("PERFOMIA", 50, 40);

  doc.fillColor(secondaryColor);
  doc.fontSize(10).font("Helvetica").text("Ficha de Empleado", 50, 75);

  // Separador
  doc.moveTo(50, 95).lineTo(550, 95).stroke("#e5e7eb");

  // Información personal
  let yPos = 120;

  doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("Información Personal", 50, yPos);
  yPos += 30;

  const personalInfo = [
    ["Nombre Completo:", employee.nombreCompleto || "-"],
    ["Email:", employee.email || "-"],
    ["Teléfono:", employee.telefono || "-"],
    ["Documento:", employee.documento || "-"],
    ["Estado:", employee.estado_empleado || "Activo"],
  ];

  doc.fillColor(secondaryColor).fontSize(11).font("Helvetica");

  personalInfo.forEach(([label, value]) => {
    doc.font("Helvetica-Bold").text(label, 50, yPos, { width: 150 });
    doc.font("Helvetica").text(value, 200, yPos, { width: 350 });
    yPos += 25;
  });

  yPos += 15;

  // Información de ubicación
  doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("Ubicación", 50, yPos);
  yPos += 30;

  const locationInfo = [
    ["Dirección:", employee.direccion || "-"],
    ["Ciudad:", employee.ciudad || "-"],
    ["Estado:", employee.estado || "-"],
  ];

  doc.fillColor(secondaryColor).fontSize(11).font("Helvetica");

  locationInfo.forEach(([label, value]) => {
    doc.font("Helvetica-Bold").text(label, 50, yPos, { width: 150 });
    doc.font("Helvetica").text(value, 200, yPos, { width: 350 });
    yPos += 25;
  });

  yPos += 15;

  // Información laboral
  doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("Información Laboral", 50, yPos);
  yPos += 30;

  const jobInfo = [
    ["Rol:", employee.rol || "-"],
    ["Departamento:", employee.departamento || "-"],
    ["Jefe Directo:", employee.jefe || "-"],
    ["Tipo de Contrato:", employee.tipoContrato || "-"],
    ["Salario:", employee.salario ? `$${employee.salario.toLocaleString()}` : "-"],
    ["Fecha de Ingreso:", employee.fechaIngreso ? new Date(employee.fechaIngreso).toLocaleDateString("es-ES") : "-"],
  ];

  doc.fillColor(secondaryColor).fontSize(11).font("Helvetica");

  jobInfo.forEach(([label, value]) => {
    doc.font("Helvetica-Bold").text(label, 50, yPos, { width: 150 });
    doc.font("Helvetica").text(value, 200, yPos, { width: 350 });
    yPos += 25;
  });

  // Si hay descripción
  if (employee.descripcion) {
    yPos += 15;
    doc.fillColor(primaryColor).fontSize(14).font("Helvetica-Bold").text("Descripción", 50, yPos);
    yPos += 20;

    doc.fillColor(secondaryColor).fontSize(11).font("Helvetica");
    doc.text(employee.descripcion, 50, yPos, { width: 500 });
  }

  // Footer
  doc
    .fontSize(9)
    .fillColor("#9ca3af")
    .text(
      `Documento generado por Perfomia - ${new Date().toLocaleDateString("es-ES")}`,
      50,
      750,
      { align: "center" }
    );

  doc.end();
}

export function generateTeamReportPDF(employees, stream) {
  const doc = new PDFDocument();
  doc.pipe(stream);

  const primaryColor = "#10b981";
  const secondaryColor = "#1f2937";

  // Encabezado
  doc.fillColor(primaryColor).fontSize(28).font("Helvetica-Bold").text("PERFOMIA", 50, 40);

  doc.fillColor(secondaryColor).fontSize(10).font("Helvetica").text("Reporte del Equipo", 50, 75);

  // Fecha
  doc
    .fontSize(9)
    .fillColor("#6b7280")
    .text(`Generado: ${new Date().toLocaleDateString("es-ES")}`, 50, 95);

  // Tabla
  let yPos = 130;
  const columnWidths = [80, 90, 100, 90, 75];
  const columns = ["Nombre", "Email", "Rol", "Departamento", "Estado"];

  // Encabezado de tabla
  doc.fillColor(primaryColor).fontSize(10).font("Helvetica-Bold");

  let xPos = 50;
  columns.forEach((col, i) => {
    doc.text(col, xPos, yPos, { width: columnWidths[i], align: "left" });
    xPos += columnWidths[i];
  });

  yPos += 25;

  // Separador
  doc.moveTo(50, yPos).lineTo(550, yPos).stroke("#e5e7eb");
  yPos += 15;

  // Filas
  doc.fillColor(secondaryColor).fontSize(9).font("Helvetica");

  employees.forEach((emp) => {
    const empleadoData = [
      emp.nombreCompleto || "-",
      emp.email || "-",
      emp.rol || "-",
      emp.departamento || "-",
      emp.estado_empleado || "Activo",
    ];

    xPos = 50;
    empleadoData.forEach((data, i) => {
      doc.text(data, xPos, yPos, { width: columnWidths[i], align: "left" });
      xPos += columnWidths[i];
    });

    yPos += 20;

    // Nueva página si es necesario
    if (yPos > 700) {
      doc.addPage();
      yPos = 50;
    }
  });

  // Footer
  doc
    .fontSize(9)
    .fillColor("#9ca3af")
    .text(
      `Documento generado por Perfomia - Total de empleados: ${employees.length}`,
      50,
      750,
      { align: "center" }
    );

  doc.end();
}
