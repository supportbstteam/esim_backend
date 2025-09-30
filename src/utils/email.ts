// src/utils/email.ts
import nodemailer from "nodemailer";

// Create test account (Ethereal)
export const sendOtpEmail = async (to: string, otp: string) => {
    // Create a test account for dev
    const testAccount = await nodemailer.createTestAccount();

    const transporter = nodemailer.createTransport({
        host: "smtp.ethereal.email",
        port: 587,
        secure: false,
        auth: {
            user: testAccount.user,
            pass: testAccount.pass,
        },
    });

    const info = await transporter.sendMail({
        from: '"MyApp OTP" <no-reply@myapp.com>',
        to,
        subject: "Your OTP Code",
        text: `Your OTP code is: ${otp}`,
        html: `<p>Your OTP code is: <b>${otp}</b></p>`,
    });

    console.log("Preview URL: %s", nodemailer.getTestMessageUrl(info));
};
