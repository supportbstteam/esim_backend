// src/utils/email.ts
import nodemailer from "nodemailer";

export const sendOtpEmail = async (to: string, otp: string) => {
    const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: false, // true if using port 465
        auth: {
            // user: process.env.SMTP_USER,
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS,
        },
    });

    const info = await transporter.sendMail({
        from: `"eSIM Connect" <${process.env.SMTP_USER}>`, // brand name
        to,
        subject: "🔑 Your eSIM OTP Code",
        text: `Your OTP code for eSIM Connect is: ${otp}. It expires in 10 minutes. If you didn't request this, please ignore this email.`,
        html: `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
        <h2 style="color: #0070f3;">Welcome to eSIM Connect!</h2>
        <p>Use the following One-Time Password (OTP) to complete your verification. This OTP is valid for <b>10 minutes</b>.</p>
        <div style="background: #f4f4f4; padding: 15px; text-align: center; font-size: 24px; letter-spacing: 4px; margin: 20px 0; border-radius: 5px;">
            <b>${otp}</b>
        </div>
        <p>If you did not request this OTP, please ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #e0e0e0;" />
        <p style="font-size: 12px; color: #555;">eSIM Connect &copy; ${new Date().getFullYear()}. All rights reserved.</p>
    </div>
    `,
    });


    console.log("✅ OTP email sent: %s", info.messageId);
};
