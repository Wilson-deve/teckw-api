import nodemailer from "nodemailer";
import otpGenerator from "otp-generator";
import { Order, User } from "@prisma/client";

const transporter = nodemailer.createTransport({
  service: "Gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD,
  },
});

export const sendPasswordResetOtp = async (email: string, otp: string) => {
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

  await transporter.sendMail(mailOptions);
};

interface OrderItem {
  product: {
    name: string;
  };
  quantity: number;
  price: number;
}

interface ShippingAddress {
  street: string;
  province: string;
  district: string;
  sector: string;
}

interface ExtendedOrder extends Order {
  items: OrderItem[];
  shippingAddress: ShippingAddress;
}

export const sendOrderConfirmationEmail = async (
  order: ExtendedOrder,
  user: User
) => {
  const htmlContent = getOrderConfirmationTemplate(order, user);

  const mailOptions = {
    from: process.env.EMAIL_FROM,
    to: user.email,
    subject: `TeckW - Order Confirmation #${order.orderNumber}`,
    html: htmlContent,
  };

  await transporter.sendMail(mailOptions);
};

const getOrderConfirmationTemplate = (
  order: ExtendedOrder,
  user: User
): string => {
  const items = order.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${
        item.product.name
      }</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">${
        item.quantity
      }</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">$${item.price.toFixed(
        2
      )}</td>
      <td style="padding: 10px; border-bottom: 1px solid #eee;">$${(
        item.price * item.quantity
      ).toFixed(2)}</td>
    </tr>
  `
    )
    .join("");

  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
      <h2 style="color: #333;">Order Confirmation</h2>
      <p>Hello ${user.firstname},</p>
      <p>Thank you for your order! We're processing it now and will notify you once it's shipped.</p>
      
      <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
        <h3 style="margin-top: 0;">Order Summary</h3>
        <p><strong>Order Number:</strong> ${order.orderNumber}</p>
        <p><strong>Date:</strong> ${new Date(
          order.createdAt
        ).toLocaleDateString()}</p>
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
            <td style="padding: 10px; font-weight: bold;">$${order.total.toFixed(
              2
            )}</td>
          </tr>
        </tfoot>
      </table>
      
      <div style="margin: 20px 0; padding: 15px; background-color: #f9f9f9; border-radius: 4px;">
        <h3 style="margin-top: 0;">Shipping Address</h3>
        <p>${order.shippingAddress.street}</p>
        <p>${(order.shippingAddress as any).province}, ${
    (order.shippingAddress as any).district
  } ${(order.shippingAddress as any).sector}</p>
      </div>
      
      <p>If you have any questions about your order, please contact our customer service team.</p>
      <p>Best regards,<br>The TeckW Team</p>
    </div>
  `;
};

export const generateOtp = () => {
  return otpGenerator.generate(6, {
    digits: true,
    lowerCaseAlphabets: false,
    upperCaseAlphabets: false,
    specialChars: false,
  });
};
