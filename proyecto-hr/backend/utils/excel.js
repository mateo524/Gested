import ExcelJS from "exceljs";

export async function extractExcelData(filePath) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet =
    workbook.getWorksheet("Datos PUNTUALES") || workbook.worksheets[0];

  if (!sheet) {
    throw new Error("No se encontró ninguna hoja en el archivo Excel");
  }

  const data = [];

  sheet.eachRow((row, rowNumber) => {
    if (rowNumber < 2) return;

    const apellido = row.getCell(15).value;
    const nombre = row.getCell(16).value;
    const rol = row.getCell(22).value;
    const email = row.getCell(23).value;

    if (!nombre && !apellido && !email) return;

    data.push({
      apellido: apellido ? String(apellido).trim() : "",
      nombre: nombre ? String(nombre).trim() : "",
      nombreCompleto: `${nombre ? String(nombre).trim() : ""} ${
        apellido ? String(apellido).trim() : ""
      }`.trim(),
      rol: rol ? String(rol).trim() : "",
      email: email ? String(email).trim() : "",
    });
  });

  return {
    hoja: sheet.name,
    registros: data.length,
    datos: data,
  };
}