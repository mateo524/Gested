import { Router } from "express";
import PDFDocument from "pdfkit";
import Employee from "../models/Employee.js";
import Evaluation from "../models/Evaluation.js";
import DevelopmentPlan from "../models/DevelopmentPlan.js";
import { auth } from "../middleware/auth.js";
import { permit } from "../middleware/permit.js";

const router = Router();

router.get(
  "/pdf-export/employee/:employeeId",
  auth,
  permit("view_reports"),
  async (req, res) => {
    try {
      const { employeeId } = req.params;
      const companyId = req.user.companyId;

      const employee = await Employee.findOne({ _id: employeeId, companyId });
      if (!employee) {
        return res.status(404).json({ message: "Employee not found" });
      }

      const evaluations = await Evaluation.find({
        empleadoId: employeeId,
        estado: { $in: ["CERRADO", "PUBLICADA"] },
      })
        .sort({ updatedAt: -1 })
        .limit(3)
        .populate("evaluadorId", "nombre apellido");

      const developmentPlans = await DevelopmentPlan.find({
        empleadoId: employeeId,
        activo: true,
      }).limit(5);

      const doc = new PDFDocument({ margin: 50 });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="employee-${employee.apellido}-report.pdf"`
      );

      doc.pipe(res);

      // Header
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .fillColor("#1a1a2e")
        .text("ZENTOR", { align: "center" });

      doc
        .fontSize(12)
        .font("Helvetica")
        .fillColor("#555")
        .text(employee.companyName || companyId.toString(), { align: "center" });

      doc
        .fontSize(10)
        .fillColor("#888")
        .text(
          `Fecha: ${new Date().toLocaleDateString("es-AR", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`,
          { align: "center" }
        );

      doc.moveDown(1.5);
      doc
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .strokeColor("#cccccc")
        .lineWidth(1)
        .stroke();
      doc.moveDown(1);

      // Section: Datos del empleado
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#1a1a2e")
        .text("Datos del empleado");
      doc.moveDown(0.5);

      const employeeFields = [
        ["Nombre", employee.nombre],
        ["Apellido", employee.apellido],
        ["Cargo", employee.cargo],
        ["Departamento", employee.departamento],
        ["Email", employee.email],
      ];

      for (const [label, value] of employeeFields) {
        doc
          .fontSize(10)
          .font("Helvetica-Bold")
          .fillColor("#333")
          .text(`${label}: `, { continued: true })
          .font("Helvetica")
          .fillColor("#555")
          .text(value || "—");
      }

      doc.moveDown(1.5);
      doc
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .strokeColor("#cccccc")
        .lineWidth(1)
        .stroke();
      doc.moveDown(1);

      // Section: Evaluaciones recientes
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#1a1a2e")
        .text("Evaluaciones recientes");
      doc.moveDown(0.5);

      if (evaluations.length === 0) {
        doc
          .fontSize(10)
          .font("Helvetica")
          .fillColor("#888")
          .text("Sin evaluaciones cerradas o publicadas.");
      } else {
        for (const ev of evaluations) {
          const evaluador = ev.evaluadorId
            ? `${ev.evaluadorId.nombre} ${ev.evaluadorId.apellido}`
            : "—";

          doc
            .fontSize(11)
            .font("Helvetica-Bold")
            .fillColor("#333")
            .text(
              `Periodo: ${ev.periodo || "—"}  |  Etapa: ${ev.etapa || "—"}`
            );
          doc
            .fontSize(10)
            .font("Helvetica")
            .fillColor("#555")
            .text(`Puntuación: ${ev.puntuacion ?? "—"}`);
          doc.text(`Evaluador: ${evaluador}`);
          if (ev.comentario) {
            doc.text(`Comentario: ${ev.comentario}`);
          }
          doc.moveDown(0.8);
        }
      }

      doc.moveDown(0.5);
      doc
        .moveTo(50, doc.y)
        .lineTo(doc.page.width - 50, doc.y)
        .strokeColor("#cccccc")
        .lineWidth(1)
        .stroke();
      doc.moveDown(1);

      // Section: Planes de desarrollo
      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .fillColor("#1a1a2e")
        .text("Planes de desarrollo");
      doc.moveDown(0.5);

      if (developmentPlans.length === 0) {
        doc
          .fontSize(10)
          .font("Helvetica")
          .fillColor("#888")
          .text("Sin planes de desarrollo activos.");
      } else {
        for (const plan of developmentPlans) {
          const fechaLimite = plan.fechaLimite
            ? new Date(plan.fechaLimite).toLocaleDateString("es-AR")
            : "—";

          doc
            .fontSize(11)
            .font("Helvetica-Bold")
            .fillColor("#333")
            .text(`Objetivo: ${plan.objetivo || "—"}`);
          doc
            .fontSize(10)
            .font("Helvetica")
            .fillColor("#555")
            .text(`Estado: ${plan.estado || "—"}`);
          doc.text(`Fecha límite: ${fechaLimite}`);
          doc.moveDown(0.8);
        }
      }

      // Footer
      const pageHeight = doc.page.height;
      doc
        .fontSize(9)
        .font("Helvetica")
        .fillColor("#aaa")
        .text(
          "Generado por ZENTOR — confidencial",
          50,
          pageHeight - 50,
          { align: "center", width: doc.page.width - 100 }
        );

      doc.end();
    } catch (err) {
      console.error("PDF export error:", err);
      if (!res.headersSent) {
        res.status(500).json({ message: "Error generating PDF report" });
      }
    }
  }
);

export default router;
