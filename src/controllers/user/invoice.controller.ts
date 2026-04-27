import { Request, Response } from "express";
import { AppDataSource } from "../../data-source";
import { Order } from "../../entity/order.entity";
import PDFDocument from "pdfkit";
import moment from "moment";

export const generateInvoice = async (req: Request, res: Response) => {
    const { orderId } = req.params;

    try {
        const orderRepo = AppDataSource.getRepository(Order);
        const order = await orderRepo.findOne({
            where: { id: orderId as any },
            relations: ["user", "esims", "transaction", "esims.country"],
        });

        if (!order) {
            return res.status(404).json({ message: "Order not found" });
        }

        // Fetch contact data from database
        const contactData = await AppDataSource.query(`
            SELECT type, value, position 
            FROM contact
        `);

        // Organize contact data
        const companyAddress = contactData.find((c: any) => c.type === 'Address' && c.position === 'company')?.value || '';
        const companyEmail = contactData.find((c: any) => c.type === 'Email' && c.position === 'company')?.value || '';
        const supportPhone = contactData.find((c: any) => c.type === 'Chat' && c.position === '24/7 help support')?.value || '';
        const companyNumber = contactData.find((c: any) => c.type === 'Other' && c.position === 'Company number')?.value || '';

        const doc = new PDFDocument({ margin: 50, size: 'A4' });
        const filename = `invoice-${order.orderCode}.pdf`;

        res.setHeader("Content-disposition", `inline; filename="${filename}"`);
        res.setHeader("Content-type", "application/pdf");
        doc.pipe(res);

        // ==================== HEADER SECTION ====================
        doc
            .fillColor("#000000")
            .font("Helvetica-Bold")
            .fontSize(20)
            .text("E-SIM Aero", 50, 50)
            .fontSize(25)
            .fillColor("#444444")
            .text("INVOICE", 400, 50, { align: "right" });

        // ==================== COMPANY CONTACT INFO ====================
        let cursorY = 85; // Starting Y position for company info
        
        doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#000000");

        // Address with dynamic height
        if (companyAddress) {
            doc.text(companyAddress, 50, cursorY, { lineGap: 2, width: 300 });
            cursorY = doc.y + 10; // ✅ Update cursor after address
        }

        doc.text(`Email: ${companyEmail || ''}`, 50, cursorY);
        cursorY = doc.y + 5;

        doc.text(`Phone: ${supportPhone || ''}`, 50, cursorY);
        cursorY = doc.y + 5;

        doc.text(`Reg. No: ${companyNumber || ''}`, 50, cursorY);
        cursorY = doc.y + 15; // ✅ Extra spacing after contact info

        // ==================== INVOICE META (Right Side) ====================
        doc
            .fontSize(10)
            .font("Helvetica-Bold")
            .text(`INVOICE #: INV-${order.orderCode}`, 400, 85, { align: "right" })
            .text(`DATE: ${moment(order.createdAt).format("MMM DD, YYYY")}`, 400, 100, { align: "right" })
            .text(`ORDER ID: ${order.orderCode}`, 400, 115, { align: "right" });

        // ==================== 🎯 BILLED TO SECTION (Fixed Spacing) ====================
        // ✅ Add guaranteed spacing before "BILLED TO"
        const billedToStartY = Math.max(cursorY, 140); // Ensure minimum Y position
        const billedToLabelY = billedToStartY + 20;    // ✅ Proper gap from contact info
        
        doc
            .fontSize(12)
            .font("Helvetica-Bold")
            .fillColor("#000000")
            .text("BILLED TO:", 50, billedToLabelY);  // ✅ Label with spacing

        const billedToContentY = billedToLabelY + 18;  // ✅ Gap after label
        
        doc
            .font("Helvetica")
            .fontSize(10)
            .text(order.name || (order.user ? `${order.user.firstName} ${order.user.lastName}` : "Guest"), 50, billedToContentY)
            .text(order.email || order.user?.email || "N/A", 50, billedToContentY + 15)
            .text(order.phone || order.user?.phone || "N/A", 50, billedToContentY + 30);

        // ==================== TABLE SECTION ====================
        const tableTop = billedToContentY + 60; // ✅ Dynamic table position based on billedTo
        const col1 = 50, col2 = 115, col3 = 210, col4 = 350, col5 = 385, col6 = 440;

        // Table Header Background
        doc
            .rect(col1 - 5, tableTop - 5, 510, 20)
            .fill("#f2f2f2")
            .stroke();

        // Table Headers
        doc
            .fillColor("#000000")
            .font("Helvetica-Bold")
            .fontSize(9)
            .text("ITEM", col1, tableTop, { width: 60 })
            .text("DESCRIPTION", col2, tableTop, { width: 90 })
            .text("ICCID", col3, tableTop, { width: 135 })
            .text("QTY", col4, tableTop, { width: 40 })
            .text("UNIT PRICE", col5, tableTop, { width: 70 })
            .text("TOTAL", col6, tableTop, { width: 90, align: "right" });

        // Table Body
        let position = tableTop + 25;
        doc.font("Helvetica").fontSize(8);

        order.esims.forEach((esim, index) => {
            if (position > 650) {
                doc.addPage();
                position = 50;
            }

            const description = `${esim.country?.name || "Global"} ${esim.productName}`;
            const unitPrice = Number(esim.price || 0).toFixed(2);
            const total = Number(esim.price || 0).toFixed(2);
            const iccid = esim.iccid || "TBD";

            doc
                .text("E-SIM Plan", col1, position, { width: 60 })
                .text(description, col2, position, { width: 90 })
                .text(iccid, col3, position, { width: 135 })
                .text("1", col4, position, { width: 40 })
                .text(`$${unitPrice}`, col5, position, { width: 70 })
                .text(`$${total}`, col6, position, { width: 90, align: "right" });

            position += 22;

            if (index < order.esims.length - 1) {
                doc.moveTo(col1 - 5, position - 3)
                   .lineTo(col6 + 90, position - 3)
                   .lineWidth(0.5)
                   .strokeColor("#eeeeee")
                   .stroke()
                   .strokeColor("#000000")
                   .lineWidth(1);
            }
        });

        // ==================== TOTALS SECTION ====================
        const totalsPosition = position + 25;
        if (totalsPosition > 600) {
            doc.addPage();
            position = 50;
        }

        // Payment Info (Left)
        doc
            .font("Helvetica-Bold")
            .fontSize(9)
            .text("Payment Method:", col1, totalsPosition)
            .font("Helvetica")
            .text(order.transaction?.paymentGateway || "Card/PayPal", col1, totalsPosition + 13)
            .font("Helvetica-Bold")
            .text("Transaction ID:", col1, totalsPosition + 28)
            .font("Helvetica")
            .text(order.transaction?.transactionId || "N/A", col1, totalsPosition + 41)
            .font("Helvetica-Bold")
            .text("Payment Date:", col1, totalsPosition + 56)
            .font("Helvetica")
            .text(moment(order.createdAt).format("MMM DD YYYY, hh:mm A"), col1, totalsPosition + 69);

        // Totals (Right)
        const rightLabelX = 350;
        const rightValueX = 470;

        doc
            .font("Helvetica-Bold")
            .fontSize(9)
            .text("SUBTOTAL:", rightLabelX, totalsPosition)
            .text(`$${Number(order.totalAmount || 0).toFixed(2)}`, rightValueX, totalsPosition, { align: "right" })
            .text("TAX:", rightLabelX, totalsPosition + 20)
            .text("$0.00", rightValueX, totalsPosition + 20, { align: "right" })
            .fontSize(11)
            .font("Helvetica-Bold")
            .text("TOTAL PAID:", rightLabelX, totalsPosition + 45)
            .text(`$${Number(order.totalAmount || 0).toFixed(2)}`, rightValueX, totalsPosition + 45, { align: "right" });

        // ==================== FOOTER ====================
        const pageHeight = doc.page.height;
        const footerTop = pageHeight - 80;

        doc
            .fontSize(8)
            .font("Helvetica")
            .fillColor("#444444")
            .text("This is a system-generated invoice and does not require a signature.", 50, footerTop, { align: "center", width: 500 })
            .font("Helvetica-Bold")
            .text("Thank you for choosing E-SIM Aero.", 50, footerTop + 15, { align: "center", width: 500 });

        doc.end();

    } catch (error: any) {
        console.error("Invoice generation error:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};