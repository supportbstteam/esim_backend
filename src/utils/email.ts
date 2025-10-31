import nodemailer from "nodemailer";
import { AppDataSource } from "../data-source";
import { Admin } from "../entity/Admin.entity";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: Number(process.env.SMTP_PORT) === 465,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// ---------- Helper: Base Template ----------
export const baseTemplate = (title: string, content: string) => `
  <div style="font-family: Arial, sans-serif; background-color: #f8f9fa; padding: 20px;">
    <div style="max-width: 600px; margin: auto; background: #ffffff; border-radius: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); overflow: hidden;">
      <div style="background: linear-gradient(90deg, #0070f3, #00b4d8); color: #fff; padding: 15px 20px; font-size: 18px; font-weight: bold;">
        ${title}
      </div>
      <div style="padding: 20px; font-size: 15px; line-height: 1.6;">
        ${content}
      </div>
      <div style="background-color: #f1f1f1; text-align: center; padding: 12px; font-size: 12px; color: #555;">
        © ${new Date().getFullYear()} eSIM Connect | All Rights Reserved
      </div>
    </div>
  </div>
`;

/**
 * 🔑 Send OTP Email for Verification
 * @param to - recipient email
 * @param otp - one-time password (6-digit)
 */
export const sendOtpEmail = async (to: string, otp: string) => {
  try {
    const subject = "🔑 Your eSIM Connect Verification Code";

    const text = `Your OTP for eSIM Connect is: ${otp}. It expires in 10 minutes. If you did not request this, please ignore this email.`;

    const html = baseTemplate(
      "Email Verification Code",
      `
        <p>Hi there,</p>
        <p>Use the following One-Time Password (OTP) to verify your account on <strong>eSIM Connect</strong>. It will expire in <b>10 minutes</b>.</p>
        <div style="text-align: center; margin: 20px 0;">
          <div style="display: inline-block; background: #f4f8ff; border: 1px dashed #0070f3; border-radius: 8px; padding: 15px 25px; font-size: 24px; letter-spacing: 6px; color: #0070f3; font-weight: bold;">
            ${otp}
          </div>
        </div>
        <p>If you didn’t request this OTP, please ignore this email or contact our support team immediately.</p>
        <p style="margin-top: 25px;">Thanks,<br><strong>The eSIM Connect Team</strong></p>
      `
    );

    const info = await transporter.sendMail({
      from: `"eSIM Connect" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log(`✅ OTP email sent to ${to} (messageId: ${info.messageId})`);
  } catch (error: any) {
    console.error("❌ Failed to send OTP email:", error.message);
  }
};

// ---------- 1️⃣ Order Confirmation Email ----------
export const sendOrderConfirmationEmail = async (userEmail: string, order: any) => {
  const html = baseTemplate(
    "Order Confirmation",
    `
      <p>Hi <strong>${order.user.firstName}</strong>,</p>
      <p>Thank you for your order! Your eSIM order has been successfully placed.</p>
      <table style="width:100%; border-collapse: collapse; margin-top: 10px;">
        <tr><td><b>Order ID:</b></td><td>${order.id}</td></tr>
        <tr><td><b>Plan:</b></td><td>${order.planName}</td></tr>
        <tr><td><b>Amount:</b></td><td>$${order.amount}</td></tr>
        <tr><td><b>Status:</b></td><td style="text-transform: capitalize;">${order.status}</td></tr>
      </table>
      <p>You will receive a follow-up email once your eSIM is activated.</p>
    `
  );

  await transporter.sendMail({
    from: `"eSIM Connect" <${process.env.SMTP_USER}>`,
    to: userEmail,
    subject: `🛒 Order Confirmation - ${order.id}`,
    html,
  });

  console.log("✅ Order email sent to user:", userEmail);
};

// ---------- 1️⃣(b) Order Notification to Admin ----------
export const sendAdminOrderNotification = async (adminEmail: string, order: any) => {
  const html = baseTemplate(
    "New Order Placed",
    `
      <p>A new order has been placed by <strong>${order.user.firstName} ${order.user.lastName}</strong>.</p>
      <p><b>Order ID:</b> ${order.id}<br/>
      <b>Amount:</b> $${order.amount}<br/>
      <b>Status:</b> ${order.status}</p>
      <p><a href="${process.env.ADMIN_DASHBOARD_URL || "#"}" style="color: #0070f3;">View in Dashboard</a></p>
    `
  );

  await transporter.sendMail({
    from: `"eSIM Connect Orders" <${process.env.SMTP_USER}>`,
    to: adminEmail,
    subject: `🧾 New Order - ${order.id}`,
    html,
  });

  console.log("✅ Order email sent to admin:", adminEmail);
};

// ---------- 2️⃣(b) Welcome Email to New User ----------
export const sendUserWelcomeEmail = async (userEmail: string, user: any) => {
  const html = baseTemplate(
    "Welcome to eSIM Connect 🎉",
    `
      <p>Hi <strong>${user.firstName}</strong>,</p>
      <p>Welcome to <strong>eSIM Connect</strong>! We're excited to have you on board.</p>
      <p>You can now explore and purchase eSIM plans that fit your travel and connectivity needs.</p>
      <ul style="margin-top:10px;">
        <li>🌍 Global eSIM coverage</li>
        <li>⚡ Instant activation</li>
        <li>💳 Secure payments</li>
      </ul>
      <p style="margin-top:20px;">If you have any questions, our support team is always here to help.</p>
      <p>Cheers,<br><strong>The eSIM Connect Team</strong></p>
    `
  );

  await transporter.sendMail({
    from: `"eSIM Connect Support" <${process.env.SMTP_USER}>`, // from admin
    to: userEmail,
    subject: "👋 Welcome to eSIM Connect",
    html,
  });

  console.log(`✅ Welcome email sent to user: ${userEmail}`);
};

// ---------- 2️⃣(c) Notify Admin When User Verifies OTP ----------
export const sendAdminUserVerifiedNotification = async (adminEmail: string, user: any) => {
  const html = baseTemplate(
    "User Verified Account ✅",
    `
      <p>Hello Admin,</p>
      <p>The following user has successfully verified their email and activated their account:</p>
      <table style="width:100%; border-collapse: collapse; margin-top: 10px;">
        <tr><td><b>Name:</b></td><td>${user.firstName} ${user.lastName}</td></tr>
        <tr><td><b>Email:</b></td><td>${user.email}</td></tr>
        <tr><td><b>Country:</b></td><td>${user.country || "N/A"}</td></tr>
        <tr><td><b>Verified At:</b></td><td>${new Date().toLocaleString()}</td></tr>
      </table>
      <p>You can view the user details in the admin dashboard.</p>
      <p style="margin-top:20px;">– The eSIM Connect System</p>
    `
  );

  await transporter.sendMail({
    from: `"eSIM Connect System" <${process.env.SMTP_USER}>`,
    to: adminEmail,
    subject: `✅ User Verified: ${user.firstName} ${user.lastName}`,
    html,
  });

  console.log(`✅ Admin notified about verified user: ${user.email}`);
};

// ---------- 3️⃣ Password Updated (User) ----------
export const sendPasswordUpdateEmail = async (userEmail: string, userName: string) => {
  const html = baseTemplate(
    "Password Updated Successfully",
    `
      <p>Hi <strong>${userName}</strong>,</p>
      <p>Your password has been successfully updated. If this wasn’t you, please reset your password immediately or contact support.</p>
    `
  );

  await transporter.sendMail({
    from: `"eSIM Connect Security" <${process.env.SMTP_USER}>`,
    to: userEmail,
    subject: "🔐 Password Updated Successfully",
    html,
  });

  console.log("✅ Password update email sent:", userEmail);
};

// ---------- 4️⃣ Refund Notification (User + Admin) ----------
export const sendRefundEmails = async (userEmail: string, adminEmail: string, refund: any) => {
  const userHtml = baseTemplate(
    "Refund Request Submitted",
    `
      <p>Hi <strong>${refund.user.firstName}</strong>,</p>
      <p>Your refund request for order <b>${refund.order.id}</b> has been received and is being reviewed.</p>
      <p>Refund ID: <b>${refund.id}</b><br>Status: <b>${refund.status}</b></p>
      <p>We’ll notify you once it’s processed.</p>
    `
  );

  const adminHtml = baseTemplate(
    "New Refund Request",
    `
      <p>A user has requested a refund.</p>
      <table style="width:100%; border-collapse: collapse;">
        <tr><td><b>User:</b></td><td>${refund.user.firstName} ${refund.user.lastName}</td></tr>
        <tr><td><b>Email:</b></td><td>${refund.user.email}</td></tr>
        <tr><td><b>Order ID:</b></td><td>${refund.order.id}</td></tr>
        <tr><td><b>Transaction ID:</b></td><td>${refund.transaction.id}</td></tr>
        <tr><td><b>Status:</b></td><td>${refund.status}</td></tr>
      </table>
      <p><a href="${process.env.ADMIN_DASHBOARD_URL || "#"}" style="color: #0070f3;">View Refund</a></p>
    `
  );

  await transporter.sendMail({
    from: `"eSIM Connect Refunds" <${process.env.SMTP_USER}>`,
    to: userEmail,
    subject: `💰 Refund Request Received - ${refund.id}`,
    html: userHtml,
  });

  await transporter.sendMail({
    from: `"eSIM Connect Refunds" <${process.env.SMTP_USER}>`,
    to: adminEmail,
    subject: `💰 New Refund Request - ${refund.id}`,
    html: adminHtml,
  });

  console.log("✅ Refund emails sent (user + admin)");
};

/**
 * 🔒 Send email notification when user updates password
 * @param to - user's email
 * @param name - user's first name
 */
export const sendPasswordChangeEmail = async (to: string, name?: string) => {
  try {
    const subject = "🔒 Your eSIM Connect Password Was Updated";

    const text = `Hi ${name || "User"},\n\nYour password on eSIM Connect was successfully changed. If this wasn't you, please reset your password immediately or contact our support team.\n\nStay secure,\nThe eSIM Connect Team`;

    const html = baseTemplate(
      "Your Password Was Updated",
      `
        <p>Hi ${name || "there"},</p>
        <p>This is a confirmation that your <strong>eSIM Connect</strong> password has been successfully changed.</p>
        <p>If this wasn’t you, please <a href="https://esimconnect.com/reset-password" style="color:#0070f3;text-decoration:none;font-weight:bold;">reset your password</a> immediately or contact our support team.</p>
        <div style="margin-top:20px; background:#fff8e1; padding:10px 15px; border-radius:6px; border-left:4px solid #ff9800;">
          <strong>Security Tip:</strong> Never share your password or OTP with anyone.
        </div>
        <p style="margin-top:25px;">Thanks,<br><strong>The eSIM Connect Team</strong></p>
      `
    );

    await transporter.sendMail({
      from: `"eSIM Connect" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log(`✅ Password change email sent to ${to}`);
  } catch (error: any) {
    console.error("❌ Failed to send password change email:", error.message);
  }
};

/**
 * 🚫 Notify user that their account has been blocked by admin
 */
export const sendUserBlockedEmail = async (to: string, name?: string, reason?: string) => {
  try {
    const subject = "🚫 Your eSIM Connect Account Has Been Blocked";

    const text = `Hi ${name || "User"},\n\nYour eSIM Connect account has been blocked by our team. ${reason ? `Reason: ${reason}` : ""}\nIf you believe this was a mistake, please contact support.\n\n- eSIM Connect Team`;

    const html = baseTemplate(
      "Your Account Has Been Blocked",
      `
        <p>Hi ${name || "there"},</p>
        <p>Your <strong>eSIM Connect</strong> account has been <strong>temporarily blocked</strong> by our team.</p>
        ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ""}
        <p>If you believe this was done in error, please contact our <a href="mailto:support@esimconnect.com" style="color:#0070f3;">support team</a>.</p>
        <p>We’re here to help you resolve this as soon as possible.</p>
        <br/>
        <p>– The eSIM Connect Team</p>
      `
    );

    await transporter.sendMail({
      from: `"eSIM Connect" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log(`✅ Block notification sent to ${to}`);
  } catch (error: any) {
    console.error("❌ Failed to send blocked user email:", error.message);
  }
};

/**
 * 🗑️ Notify user that their account has been deleted
 */
export const sendAccountDeletedEmail = async (to: string, name?: string) => {
  try {
    const subject = "🗑️ Your eSIM Connect Account Has Been Deleted";

    const text = `Hi ${name || "User"},\n\nYour eSIM Connect account has been permanently deleted. All associated data has been removed from our system. You can re-register anytime if you wish to use our services again.\n\nThank you for being with us.\n\n- eSIM Connect Team`;

    const html = baseTemplate(
      "Your Account Has Been Deleted",
      `
        <p>Hi ${name || "there"},</p>
        <p>We wanted to let you know that your <strong>eSIM Connect</strong> account has been permanently deleted.</p>
        <p>All personal data and associated order information have been securely removed from our system.</p>
        <p>If you change your mind, you’re always welcome to rejoin anytime by creating a new account.</p>
        <br/>
        <p>Thanks for being part of our journey,</p>
        <p><strong>The eSIM Connect Team</strong></p>
      `
    );

    await transporter.sendMail({
      from: `"eSIM Connect" <${process.env.SMTP_USER}>`,
      to,
      subject,
      text,
      html,
    });

    console.log(`✅ Account deletion email sent to ${to}`);
  } catch (error: any) {
    console.error("❌ Failed to send account deletion email:", error.message);
  }
};

/**
 * 🧾 Send order success or failure email (to user + admin)
 */
export const sendOrderEmail = async (
  userEmail: string,
  userName: string,
  order: any,
  status: "completed" | "failed"
) => {
  const subject =
    status === "completed"
      ? `✅ Order Confirmation - #${order.id}`
      : `❌ Order Failed - #${order.id}`;

  const html = baseTemplate(
    status === "completed" ? "Order Completed Successfully" : "Order Failed",
    `
      <p>Hi ${userName || "there"},</p>

      ${status === "completed"
      ? `
          <p>Your order <strong>#${order.id}</strong> has been successfully completed.</p>
          <p><strong>Total Amount:</strong> $${order.totalAmount?.toFixed(2) || "0.00"}</p>
          <p><strong>Activation:</strong> ${order.activated ? "✅ Active" : "Pending"
      }</p>
          <h3>eSIM Details:</h3>
          ${order.esims && order.esims.length
        ? `<ul>${order.esims
          .map(
            (e: any) =>
              `<li><strong>${e.productName}</strong> — ${e.iccid || "No ICCID"} — ${e.validityDays} days</li>`
          )
          .join("")}</ul>`
        : "<p>No eSIM details available.</p>"
      }
          <p>Thank you for using eSIM Connect!</p>
        `
      : `
          <p>Unfortunately, your order <strong>#${order.id}</strong> could not be completed.</p>
          <p><strong>Reason:</strong> ${order.errorMessage || "Unexpected error occurred."
      }</p>
          <p>Our team has been notified and will review your transaction shortly.</p>
          <p>You may try again later or contact support.</p>
        `
    }

      <hr />
      <p style="font-size: 13px; color: #777;">Order Date: ${new Date().toLocaleString()}</p>
      <p style="font-size: 13px; color: #777;">eSIM Connect © ${new Date().getFullYear()}</p>
    `
  );

  try {
    // Send to user
    await transporter.sendMail({
      from: `"eSIM Connect" <${process.env.SMTP_USER}>`,
      to: userEmail,
      subject,
      html,
    });

    const adminRepo = AppDataSource.getRepository(Admin);

    const admin: any = await adminRepo.findOne({
      select: ["notificationMail"],
    });

    // Send to admin as well
    await transporter.sendMail({
      from: `"eSIM Connect System" <${process.env.SMTP_USER}>`,
      to: admin?.notificationMail || "admin@esimconnect.com",
      subject: `[Admin Copy] ${subject}`,
      html,
    });

    console.log(`📩 Order ${status} email sent to ${userEmail} and admin`);
  } catch (error: any) {
    console.error("❌ Failed to send order email:", error.message);
  }
};

/**
 * 🔒 Forgot Password OTP Mail
 * Sends OTP email when user requests a password reset
 */
export const sendForgotPasswordOtpEmail = async (to: string, otp: string) => {
  try {
    const subject = "🔒 Reset Your Password - OTP Verification";

    const html = baseTemplate(
      "Password Reset OTP",
      `
            <p>We received a request to reset your password for your <strong>eSIM Connect</strong> account.</p>
            <p>Use the following One-Time Password (OTP) to verify your identity. This OTP is valid for <b>10 minutes</b>.</p>
            <div style="background:#f4f4f4; padding:15px; text-align:center; font-size:24px; letter-spacing:4px; margin:20px 0; border-radius:5px;">
              <b>${otp}</b>
            </div>
            <p>If you did not request this password reset, please ignore this email or contact our support team immediately.</p>
            <p style="margin-top:25px;">Thanks,<br><strong>The eSIM Connect Team</strong></p>
            `
    );

    await transporter.sendMail({
      from: `"eSIM Connect Security" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`✅ Forgot Password OTP email sent to ${to}`);
  } catch (error: any) {
    console.error("❌ Failed to send Forgot Password OTP email:", error.message);
  }
};

