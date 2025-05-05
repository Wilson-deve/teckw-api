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
exports.authorize = exports.authenticate = void 0;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const authenticate = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const authHeader = req.headers["authorization"];
        const accessToken = authHeader === null || authHeader === void 0 ? void 0 : authHeader.split(" ")[1];
        // If no access token, try refresh flow
        if (!accessToken) {
            handleTokenRefresh(req, res, next);
            return;
        }
        try {
            // Verify access token (will throw if expired)
            const decoded = jsonwebtoken_1.default.verify(accessToken, process.env.JWT_SECRET);
            req.user = { userId: decoded.userId, role: decoded.role };
            next();
            return;
        }
        catch (accessTokenError) {
            // Only catch expiration errors - throw others
            if (accessTokenError instanceof jsonwebtoken_1.default.TokenExpiredError) {
                handleTokenRefresh(req, res, next);
                return;
            }
            throw accessTokenError;
        }
    }
    catch (error) {
        console.error("Authentication error:", error);
        res.status(401).json({
            success: false,
            code: "AUTHENTICATION_FAILED",
            message: "Please log in again",
        });
        return;
    }
});
exports.authenticate = authenticate;
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({
                success: false,
                code: "AUTHENTICATION_REQUIRED",
                message: "Authentication required for this route",
            });
            return;
        }
        if (!req.user.role || !roles.includes(req.user.role)) {
            res.status(403).json({
                success: false,
                code: "UNAUTHORIZED_ROLE",
                message: `User role ${req.user.role || "undefined"} is not authorized to access this route`,
            });
            return;
        }
        next();
    };
};
exports.authorize = authorize;
const handleTokenRefresh = (req, res, next) => __awaiter(void 0, void 0, void 0, function* () {
    var _a, _b;
    try {
        const refreshToken = ((_a = req.cookies) === null || _a === void 0 ? void 0 : _a.refreshToken) || ((_b = req.body) === null || _b === void 0 ? void 0 : _b.refreshToken);
        if (!refreshToken)
            throw new Error("No refresh token available");
        // Verify refresh token
        const decoded = jsonwebtoken_1.default.verify(refreshToken, process.env.JWT_REFRESH_SECRET);
        // Check against database
        const user = yield prisma_1.default.user.findUnique({
            where: {
                id: decoded.userId,
                refreshToken,
            },
        });
        if (!user)
            throw new Error("Invalid refresh token");
        const newAccessToken = jsonwebtoken_1.default.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "15m" });
        const newRefreshToken = jsonwebtoken_1.default.sign({ userId: user.id }, process.env.JWT_REFRESH_SECRET, { expiresIn: "7d" });
        yield prisma_1.default.user.update({
            where: { id: user.id },
            data: { refreshToken: newRefreshToken },
        });
        // Attach new tokens to response
        res.locals.newTokens = {
            accessToken: newAccessToken,
            refreshToken: newRefreshToken,
        };
        // Set user and proceed
        req.user = { userId: user.id, role: user.role };
        next();
    }
    catch (error) {
        console.error("Refresh failed:", error);
        res.status(401).json({
            success: false,
            code: "SESSION_EXPIRED",
            message: "Please log in again",
        });
    }
});
