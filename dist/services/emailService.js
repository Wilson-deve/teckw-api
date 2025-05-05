"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateOtp = exports.sendOrderConfirmationEmail = exports.sendPasswordResetOtp = void 0;
const nodemailer_1 = __importDefault(require("nodemailer"));
const otp_generator_1 = __importDefault(require("otp-generator"));
const transporter = nodemailer_1.default.createTransport({
    service: "Gmail",
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASSWORD,
    },
});
const sendPasswordResetOtp = (email, otp) => __awaiter(void 0, void 0, void 0, function* () {
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: email,
        subject: "Password Reset OTP",
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2>Password Reset Request</h2>
        <p>Your OTP for password reset is:</p>
        <h3 style="background: #00466a; margin: 0 auto; width: max-content; 
            padding: 0 10px; color: #fff; border-radius: 4px;">
          ${otp}
        </h3>
        <p>This OTP will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      </div>
    `,
    };
    yield transporter.sendMail(mailOptions);
});
exports.sendPasswordResetOtp = sendPasswordResetOtp;
const sendOrderConfirmationEmail = (order, user) => __awaiter(void 0, void 0, void 0, function* () {
    const htmlContent = getOrderConfirmationTemplate(order, user);
    const mailOptions = {
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: `TeckW - Order Confirmation #${order.orderNumber}`,
        html: htmlContent,
    };
    yield transporter.sendMail(mailOptions);
});
exports.sendOrderConfirmationEmail = sendOrderConfirmationEmail;
const getOrderConfirmationTemplate = (order, user) => {
    const items = order.items
        .map((item) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.product.name}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${item.quantity}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">$${item.price.toFixed(2)}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">$${(item.price * item.quantity).toFixed(2)}</td>
    </tr>
  `)
        .join("");
    return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
      <h2 style="color: #333;">Order Confirmation</h2>
      <p>Hello ${user.firstname},</p>
      <p>Thank you for your order! We're processing it now and will notify you once it's shipped.</p>
      
      <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
        <h3 style="margin-top: 0;">Order Summary</h3>
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Date:</strong> ${new Date(order.createdAt).toLocaleDateString()}</p>
        <p><strong>Payment Method:</strong> ${order.paymentMethod}</p>
        <p><strong>Order Status:</strong> ${order.status}</p>
      </div>
      
      <h3>Items Ordered</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr>
            <th style="text-align: left; padding: 10px; border-bottom: 2px solid #eee;">Product</th>
            <th style="text-align: left; padding: 10px; border-bottom: 2px solid #eee;">Quantity</th>
            <th style="text-align: left; padding: 10px; border-bottom: 2px solid #eee;">Price</th>
            <th style="text-align: left; padding: 10px; border-bottom: 2px solid #eee;">Total</th>
          </tr>
        </thead>
        <tbody>
          ${items}
        </tbody>
        <tfoot>
          <tr>
            <td colspan="3" style="text-align: right; padding: 10px; font-weight: bold;">Total:</td>
            <td style="padding: 10px; font-weight: bold;">$${order.total.toFixed(2)}</td>
          </tr>
        </tfoot>
      </table>
      
      <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
        <h3 style="margin-top: 0;">Shipping Address</h3>
        <p>${order.shippingAddress.street}</p>
        <p>${order.shippingAddress.province}, ${order.shippingAddress.district} ${order.shippingAddress.sector}</p>
      </div>
      
      <p>If you have any questions about your order, please contact our customer service team.</p>
      <p>Best regards,<br>The TeckW Team</p>
    </div>
  `;
};
const generateOtp = () => {
    return otp_generator_1.default.generate(6, {
        digits: true,
        lowerCaseAlphabets: false,
        upperCaseAlphabets: false,
        specialChars: false,
    });
};
exports.generateOtp = generateOtp;
