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
exports.uploadAvatar = exports.deleteUserAccount = exports.updateUserProfile = exports.getUserProfile = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma_1 = __importDefault(require("../lib/prisma"));
const types_1 = require("../types");
const getUserProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = req.params.id;
        const authenticatedUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (userId !== authenticatedUserId) {
            res.status(403).json({
                success: false,
                message: "Unauthorized to update this profile",
            });
            return;
        }
        const user = yield prisma_1.default.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                email: true,
                username: true,
                firstname: true,
                lastname: true,
                phone: true,
                avatarUrl: true,
                createdAt: true,
                updatedAt: true,
            },
        });
        if (!user) {
            res.status(404).json({
                success: false,
                message: "User not found",
            });
            return;
        }
        const response = types_1.userResponseSchema.parse(user);
        res.status(200).json({
            success: true,
            data: response,
        });
    }
    catch (error) {
        console.error("Get user error:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
});
exports.getUserProfile = getUserProfile;
const updateUserProfile = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = req.params.id;
        const authenticatedUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (userId !== authenticatedUserId) {
            res.status(403).json({
                success: false,
                code: "UNAUTHORIZED",
                message: "Unauthorized to update this profile",
            });
            return;
        }
        const updateData = types_1.updateUserSchema.parse(req.body);
        const updatedUser = yield prisma_1.default.user.update({
            where: { id: userId },
            data: updateData,
            select: {
                id: true,
                email: true,
                username: true,
                firstname: true,
                lastname: true,
                phone: true,
                avatarUrl: true,
            },
        });
        res.status(200).json({
            status: "SUCCESS",
            code: "PROFILE_UPDATED",
            message: "Profile updated successfully",
            data: updatedUser,
        });
        return;
    }
    catch (error) {
        console.error("Update error:", error);
        res.status(500).json({
            status: "error",
            code: 500,
            message: error instanceof Error ? error.message : "Failed to update profile",
        });
        return;
    }
});
exports.updateUserProfile = updateUserProfile;
const deleteUserAccount = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const userId = req.params.id;
        const { password } = req.body;
        const authenticatedUserId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        if (userId !== authenticatedUserId) {
            res.status(403).json({
                success: false,
                message: "Unauthorized to delete this account",
            });
            return;
        }
        const user = yield prisma_1.default.user.findUnique({
            where: { id: userId },
            select: { password: true },
        });
        if (!user || !(yield bcryptjs_1.default.compare(password, user.password))) {
            res.status(401).json({
                success: false,
                code: "INVALID_CREDENTIALS",
                message: "Invalid password",
            });
            return;
        }
        const deletedEmail = `deleted-${Date.now()}-${userId}@deleted.com`;
        const deletedUsername = `deleted-${Date.now()}-${userId}`;
        yield prisma_1.default.user.update({
            where: { id: userId },
            data: {
                email: deletedEmail,
                username: deletedUsername,
                active: false,
                refreshToken: null,
                deletedAt: new Date(),
            },
        });
        res.status(200).json({
            success: true,
            message: "Account deleted successfully",
        });
    }
    catch (error) {
        console.error("Delete user error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete account",
        });
    }
});
exports.deleteUserAccount = deleteUserAccount;
const uploadAvatar = (req, res) => __awaiter(void 0, void 0, void 0, function* () { });
exports.uploadAvatar = uploadAvatar;
