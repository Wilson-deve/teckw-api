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
exports.setDefaultAddress = exports.deleteAddress = exports.updateAddress = exports.addAddress = exports.getAddresses = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const zod_1 = require("zod");
const types_1 = require("../types");
const getAddresses = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const addresses = yield prisma_1.default.address.findMany({
            where: { userId: req.user.userId },
            orderBy: { isDefault: "desc" },
        });
        res.json({ success: true, data: addresses });
    }
    catch (error) {
        console.error("Get addresses error:", error);
        res
            .status(500)
            .json({ success: false, message: "Failed to get addresses" });
    }
});
exports.getAddresses = getAddresses;
const addAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const validatedData = types_1.addressSchema.parse(req.body);
        const existingCount = yield prisma_1.default.address.count({
            where: {
                userId: req.user.userId,
            },
        });
        const newAddress = yield prisma_1.default.address.create({
            data: Object.assign(Object.assign({}, validatedData), { userId: req.user.userId, isDefault: existingCount === 0 ? true : (_a = validatedData.isDefault) !== null && _a !== void 0 ? _a : false }),
        });
        if (validatedData.isDefault && existingCount > 0) {
            yield prisma_1.default.address.updateMany({
                where: {
                    userId: req.user.userId,
                    id: { not: newAddress.id },
                },
                data: { isDefault: false },
            });
        }
        res.status(201).json({ success: true, data: newAddress });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                success: false,
                error: error.errors.map((e) => ({
                    path: e.path.join("."),
                    message: e.message,
                })),
            });
            return;
        }
        res.status(500).json({ success: false, message: "Failed to add address" });
    }
});
exports.addAddress = addAddress;
const updateAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const validatedData = types_1.addressSchema.parse(req.body);
        const updateAddress = yield prisma_1.default.address.update({
            where: { id, userId: req.user.userId },
            data: validatedData,
        });
        res.json({ success: true, data: updateAddress });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                success: false,
                error: error.errors.map((e) => ({
                    path: e.path.join("."),
                    message: e.message,
                })),
            });
            return;
        }
        res.status(500).json({
            success: false,
            message: "Failed to update address",
        });
    }
});
exports.updateAddress = updateAddress;
const deleteAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const address = yield tx.address.findUnique({
                where: { id, userId: req.user.userId },
            });
            if (!address) {
                return res
                    .status(404)
                    .json({ success: false, message: "Address not found" });
            }
            yield tx.address.delete({ where: { id } });
            if (address.isDefault) {
                const firstAddress = yield tx.address.findFirst({
                    where: { userId: req.user.userId },
                });
                if (firstAddress) {
                    yield tx.address.update({
                        where: { id: firstAddress.id },
                        data: { isDefault: true },
                    });
                }
            }
        }));
        res.json({ success: true, message: "Address deleted" });
    }
    catch (error) {
        res
            .status(500)
            .json({ success: false, message: "Failed to delete address" });
    }
});
exports.deleteAddress = deleteAddress;
const setDefaultAddress = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            return [
                prisma_1.default.address.updateMany({
                    where: { userId: req.user.userId, isDefault: true },
                    data: { isDefault: false },
                }),
                prisma_1.default.address.update({
                    where: { id, userId: req.user.userId },
                    data: { isDefault: true },
                }),
            ];
        }));
        res.json({ success: true, message: "Default address updated" });
    }
    catch (error) {
        res
            .status(500)
            .json({ success: false, message: "Failed to set default address" });
    }
});
exports.setDefaultAddress = setDefaultAddress;
