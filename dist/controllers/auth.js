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
exports.logoutUser = exports.refreshToken = exports.resetPassword = exports.verifyOtp = exports.requestPasswordReset = exports.loginUser = exports.registerUser = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const types_1 = require("../types");
const prisma_1 = __importDefault(require("../lib/prisma"));
const zod_1 = require("zod");
const emailService_1 = require("../services/emailService");
const passwordUtils_1 = require("../utils/passwordUtils");
const registerUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        // Validate request body against schema
        const data = types_1.registerSchema.parse(req.body);
        // Check if user already exists
        const existingUser = yield prisma_1.default.user.findFirst({
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
            if (existingUser.username === data.username)
                conflictField = "username";
            else if (existingUser.email === data.email)
                conflictField = "email";
            else if (existingUser.phone === data.phone)
                conflictField = "phone";
            res.status(409).json({
                message: "User already exists",
                conflict: conflictField,
            });
            return;
        }
        // Hash password
        const hashedPassword = yield bcryptjs_1.default.hash(data.password, 10);
        // Create user in database
        const user = yield prisma_1.default.user.create({
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
        const token = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, {
            expiresIn: "1h",
        });
        res.status(201).json({
            success: true,
            message: "User registered successfully",
            user,
            token,
        });
        return;
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
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
            error: process.env.NODE_ENV === "development"
                ? error.message
                : undefined,
        });
        return;
    }
});
exports.registerUser = registerUser;
const loginUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    const { identifier, password } = types_1.loginSchema.parse(req.body);
    const user = yield prisma_1.default.user.findFirst({
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
    const passwordMatch = yield bcryptjs_1.default.compare(password, user.password);
    if (!passwordMatch) {
        res.status(401).json({
            success: false,
            message: "Invalid password",
            retryable: true,
        });
        return;
    }
    const accessToken = jsonwebtoken_1.default.sign({
        userId: user.id,
        username: user.username,
    }, process.env.JWT_SECRET, {
        expiresIn: "15m",
    });
    const refreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
    yield prisma_1.default.user.update({
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
    }
    catch (error) {
        // Handle validation errors
        if (error instanceof zod_1.z.ZodError) {
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
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
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
                error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
});
exports.loginUser = loginUser;
const requestPasswordReset = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email } = req.body;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            res.status(400).json({
                success: false,
                message: "Valid email is required",
            });
            return;
        }
        const user = yield prisma_1.default.user.findUnique({ where: { email } });
        if (!user) {
            res.status(200).json({
                success: true,
                message: "If this email exists, you will recieve an OTP",
            });
            return;
        }
        const otp = (0, emailService_1.generateOtp)();
        const optExpiry = new Date(Date.now() + 10 * 60 * 1000);
        yield prisma_1.default.user.update({
            where: { email },
            data: {
                resetPasswordOtp: otp,
                resetPasswordOtpExpiry: optExpiry,
            },
        });
        yield (0, emailService_1.sendPasswordResetOtp)(email, otp);
        res.status(200).json({
            success: true,
            message: "OTP sent to email is it exists in our system",
        });
    }
    catch (error) {
        console.error("Password reset error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to process password reset",
        });
    }
});
exports.requestPasswordReset = requestPasswordReset;
const verifyOtp = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            res.status(400).json({
                success: false,
                message: "Email and OTP are required",
            });
            return;
        }
        const user = yield prisma_1.default.user.findUnique({
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
        if (!user.resetPasswordOtpExpiry ||
            user.resetPasswordOtpExpiry < new Date()) {
            res.status(400).json({
                success: false,
                code: "OTP_EXPIRED",
                message: "OTP has expired",
            });
            return;
        }
        const resetToken = jsonwebtoken_1.default.sign({
            email,
            purpose: "password_reset",
            verifiedAt: new Date().toISOString(),
        }, process.env.JWT_SECRET, {
            expiresIn: "15m",
        });
        res.status(200).json({
            success: true,
            message: "OTP verified successfully",
            resetToken,
            expiresIn: 900,
        });
    }
    catch (error) {
        console.error("OTP verification error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to verify OTP",
        });
    }
});
exports.verifyOtp = verifyOtp;
const resetPassword = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { resetToken, newPassword } = req.body;
        if (!resetToken || !newPassword) {
            res.status(400).json({
                success: false,
                message: "Reset token and new password are required",
            });
            return;
        }
        const decoded = jsonwebtoken_1.default.verify(resetToken, process.env.JWT_SECRET);
        if (decoded.purpose !== "password_reset") {
            res.status(400).json({
                success: false,
                code: "INVALID_TOKEN_PURPOSE",
                message: "Invalid token type",
            });
            return;
        }
        const passwordValidation = (0, passwordUtils_1.validatePassword)(newPassword);
        if (!passwordValidation.valid) {
            res.status(400).json({
                success: false,
                code: "WEAK_PASSWORD",
                messages: passwordValidation.errors,
            });
            return;
        }
        const user = yield prisma_1.default.user.findUnique({
            where: { email: decoded.email },
            select: { password: true },
        });
        if (user && (yield bcryptjs_1.default.compare(newPassword, user.password))) {
            res.status(400).json({
                success: false,
                code: "PASSWORD_REUSE",
                message: "New password cannot be the same as the old password",
            });
            return;
        }
        const hashedPassword = yield (0, passwordUtils_1.hashPassword)(newPassword);
        yield prisma_1.default.user.update({
            where: { email: decoded.email },
            data: {
                password: hashedPassword,
                resetPasswordOtp: "",
                resetPasswordOtpExpiry: undefined,
            },
        });
        yield prisma_1.default.user.update({
            where: { email: decoded.email },
            data: { refreshToken: null },
        });
        res.status(200).json({
            success: true,
            message: "Password updated successfully",
        });
    }
    catch (error) {
        if (error instanceof jsonwebtoken_1.default.TokenExpiredError) {
            res.status(401).json({
                success: false,
                code: "RESET_TOKEN_EXPIRED",
                message: "Password reset session expired",
            });
            return;
        }
        if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
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
});
exports.resetPassword = resetPassword;
const refreshToken = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { refreshToken } = req.body;
        console.log(`Refresh attempt with token: ${refreshToken === null || refreshToken === void 0 ? void 0 : refreshToken.substring(0, 10)}...`);
        if (!refreshToken) {
            throw new Error("No refresh token available");
        }
        let decoded;
        try {
            decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
            console.log(`Token verification successful for user: ${decoded.userId}`);
        }
        catch (jwtError) {
            if (jwtError instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                console.error("JWT verification failed:", jwtError.message);
            }
            throw new Error("JWT verification failed");
        }
        const user = yield prisma_1.default.user.findFirst({
            where: {
                id: decoded.userId,
                refreshToken,
            },
        });
        console.log(`User lookup result: ${user ? "Found" : "Not found"}`);
        if (!user) {
            throw new Error("Invalid refresh token");
        }
        const newAccessToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: "5m" });
        const newRefreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
        yield prisma_1.default.user.update({
            where: { id: user.id },
            data: { refreshToken: newRefreshToken },
        });
        res.json({
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
            expiresIn: 300,
        });
    }
    catch (error) {
        res.status(401).json({
            success: false,
            code: "INVALID_REFRESH_TOKEN",
            message: "Please log in again",
        });
    }
});
exports.refreshToken = refreshToken;
const logoutUser = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (!userId) {
            res.status(401).json({
                success: false,
                code: "UNAUTHENTICATED",
                message: "User not authenticated",
            });
            return;
        }
        yield prisma_1.default.user.updateMany({
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
    }
    catch (error) {
        console.error("Logout error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to log out",
        });
    }
});
exports.logoutUser = logoutUser;
