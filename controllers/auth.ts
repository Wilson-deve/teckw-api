import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { RequestHandler } from "express";
import { loginSchema, registerSchema } from "../types";
import prisma from "../lib/prisma";
import { z } from "zod";
import { generateOtp, sendPasswordResetOtp } from "../services/emailService";
import { hashPassword, validatePassword } from "../utils/passwordUtils";

export const registerUser: RequestHandler = async (req, res) => {
  try {
    // Validate request body against schema
    const data = registerSchema.parse(req.body);

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: data.username },
          { email: data.email },
          { phone: data.phone },
        ],
      },
    });

    if (existingUser) {
      let conflictField = "";
      if (existingUser.username === data.username) conflictField = "username";
      else if (existingUser.email === data.email) conflictField = "email";
      else if (existingUser.phone === data.phone) conflictField = "phone";

      res.status(409).json({
        message: "User already exists",
        conflict: conflictField,
      });
      return;
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Create user in database
    const user = await prisma.user.create({
      data: {
        firstname: data.firstname,
        lastname: data.lastname,
        username: data.username,
        email: data.email,
        phone: data.phone,
        password: hashedPassword,
        cart: { create: {} },
        wishlist: { create: {} },
      },
      select: {
        id: true,
        firstname: true,
        lastname: true,
        username: true,
        email: true,
        phone: true,
      },
    });

    // Generate JWT token
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!, {
      expiresIn: "1h",
    });

    res.status(201).json({
      success: true,
      message: "User registered successfully",
      user,
      token,
    });
    return;
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
      return;
    }

    res.status(500).json({
      success: false,
      message: "An unexpected error occurred during registration",
      error:
        process.env.NODE_ENV === "development"
          ? (error as Error).message
          : undefined,
    });
    return;
  }
};

export const loginUser: RequestHandler = async (req, res) => {
  const { identifier, password } = loginSchema.parse(req.body);

  const user = await prisma.user.findFirst({
    where: {
      AND: [
        { active: true },
        { deletedAt: null },
        {
          OR: [{ username: identifier }, { email: identifier }],
        },
      ],
    },
  });

  if (!user) {
    res.status(401).json({
      success: false,
      message: "User not found Check your email or username and try again",
      retryable: true,
    });
    return;
  }

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) {
    res.status(401).json({
      success: false,
      message: "Invalid password",
      retryable: true,
    });
    return;
  }

  const accessToken = jwt.sign(
    {
      userId: user.id,
      username: user.username,
    },
    process.env.JWT_SECRET!,
    {
      expiresIn: "15m",
    }
  );

  const refreshToken = jwt.sign(
    { userId: user.id },
    process.env.JWT_REFRESH_SECRET!,
    { expiresIn: "7d" }
  );

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  res.status(200).json({
    success: true,
    message: "Login successful",
    accessToken,
    refreshToken,
    tokenExpiresIn: 900,
    user: {
      id: user.id,
      firstname: user.firstname,
      lastname: user.lastname,
      username: user.username,
      email: user.email,
      role: user.role,
    },
  });

  try {
  } catch (error) {
    // Handle validation errors
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: "Validation error",
        errors: error.errors.map((err) => ({
          field: err.path.join("."),
          message: err.message,
        })),
      });
      return;
    }

    // Handle known errors
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: "Invalid token",
      });
      return;
    }

    if (error instanceof Error) {
      console.error("Login error:", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error:
          process.env.NODE_ENV === "development" ? error.message : undefined,
      });
      return;
    }

    // Handle unexpected errors
    console.error("Unexpected login error:", error);
    res.status(500).json({
      success: false,
      message: "An unexpected error occurred during login",
    });
    return;
  }
};

export const requestPasswordReset: RequestHandler = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      res.status(400).json({
        success: false,
        message: "Valid email is required",
      });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(200).json({
        success: true,
        message: "If this email exists, you will recieve an OTP",
      });
      return;
    }

    const otp = generateOtp();
    const optExpiry = new Date(Date.now() + 10 * 60 * 1000);

    await prisma.user.update({
      where: { email },
      data: {
        resetPasswordOtp: otp,
        resetPasswordOtpExpiry: optExpiry,
      },
    });

    await sendPasswordResetOtp(email, otp);

    res.status(200).json({
      success: true,
      message: "OTP sent to email is it exists in our system",
    });
  } catch (error) {
    console.error("Password reset error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to process password reset",
    });
  }
};

export const verifyOtp: RequestHandler = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        resetPasswordOtp: true,
        resetPasswordOtpExpiry: true,
      },
    });

    if (!user || user.resetPasswordOtp !== otp) {
      res.status(400).json({
        success: false,
        code: "INVALID_OTP",
        message: "Invalid OTP",
      });
      return;
    }

    if (
      !user.resetPasswordOtpExpiry ||
      user.resetPasswordOtpExpiry < new Date()
    ) {
      res.status(400).json({
        success: false,
        code: "OTP_EXPIRED",
        message: "OTP has expired",
      });
      return;
    }

    const resetToken = jwt.sign(
      {
        email,
        purpose: "password_reset",
        verifiedAt: new Date().toISOString(),
      },
      process.env.JWT_SECRET!,
      {
        expiresIn: "15m",
      }
    );

    res.status(200).json({
      success: true,
      message: "OTP verified successfully",
      resetToken,
      expiresIn: 900,
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to verify OTP",
    });
  }
};

export const resetPassword: RequestHandler = async (req, res) => {
  try {
    const { resetToken, newPassword } = req.body;

    if (!resetToken || !newPassword) {
      res.status(400).json({
        success: false,
        message: "Reset token and new password are required",
      });
      return;
    }

    const decoded = jwt.verify(resetToken, process.env.JWT_SECRET!) as {
      email: string;
      purpose: string;
      // verifiedAt: string;
    };

    if (decoded.purpose !== "password_reset") {
      res.status(400).json({
        success: false,
        code: "INVALID_TOKEN_PURPOSE",
        message: "Invalid token type",
      });
      return;
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      res.status(400).json({
        success: false,
        code: "WEAK_PASSWORD",
        messages: passwordValidation.errors,
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { email: decoded.email },
      select: { password: true },
    });
    if (user && (await bcrypt.compare(newPassword, user.password))) {
      res.status(400).json({
        success: false,
        code: "PASSWORD_REUSE",
        message: "New password cannot be the same as the old password",
      });
      return;
    }

    const hashedPassword = await hashPassword(newPassword);

    await prisma.user.update({
      where: { email: decoded.email },
      data: {
        password: hashedPassword,
        resetPasswordOtp: "",
        resetPasswordOtpExpiry: undefined,
      },
    });

    await prisma.user.update({
      where: { email: decoded.email },
      data: { refreshToken: null },
    });

    res.status(200).json({
      success: true,
      message: "Password updated successfully",
    });
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        code: "RESET_TOKEN_EXPIRED",
        message: "Password reset session expired",
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        code: "INVALID_TOKEN",
        message: "Invalid reset token",
      });
      return;
    }

    console.error("Password reset error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to reset password",
    });
  }
};

export const refreshToken: RequestHandler = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    console.log(
      `Refresh attempt with token: ${refreshToken?.substring(0, 10)}...`
    );

    if (!refreshToken) {
      throw new Error("No refresh token available");
    }

    let decoded;
    try {
      decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET!) as {
        userId: string;
      };
      console.log(`Token verification successful for user: ${decoded.userId}`);
    } catch (jwtError: unknown) {
      if (jwtError instanceof jwt.JsonWebTokenError) {
        console.error("JWT verification failed:", jwtError.message);
      }
      throw new Error("JWT verification failed");
    }

    const user = await prisma.user.findFirst({
      where: {
        id: decoded.userId,
        refreshToken,
      },
    });

    console.log(`User lookup result: ${user ? "Found" : "Not found"}`);

    if (!user) {
      throw new Error("Invalid refresh token");
    }

    const newAccessToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_SECRET!,
      { expiresIn: "5m" }
    );
    const newRefreshToken = jwt.sign(
      { userId: user.id },
      process.env.JWT_REFRESH_SECRET!,
      { expiresIn: "7d" }
    );

    await prisma.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    res.json({
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      expiresIn: 300,
    });
  } catch (error) {
    res.status(401).json({
      success: false,
      code: "INVALID_REFRESH_TOKEN",
      message: "Please log in again",
    });
  }
};

export const logoutUser: RequestHandler = async (req, res) => {
  try {
    const userId = req.user?.userId;
    if (!userId) {
      res.status(401).json({
        success: false,
        code: "UNAUTHENTICATED",
        message: "User not authenticated",
      });
      return;
    }

    await prisma.user.updateMany({
      where: { id: userId, refreshToken: { not: null } },
      data: { refreshToken: null },
    });

    if (!req.user) {
      res.status(200).json({
        success: true,
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to log out",
    });
  }
};
