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
exports.cancelOrder = exports.getOrderDetails = exports.getUserOrders = exports.createOrder = void 0;
const prisma_1 = __importDefault(require("../lib/prisma"));
const zod_1 = require("zod");
const types_1 = require("../types");
const orderNumberGenerator_1 = require("../utils/orderNumberGenerator");
const client_1 = require("@prisma/client");
const emailService_1 = require("../services/emailService");
const createOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { shippingAddressId, paymentMethod } = types_1.createOrderSchema.parse(req.body);
        const userId = req.user.userId;
        const orderNumber = yield (0, orderNumberGenerator_1.generateOrderNumber)(prisma_1.default);
        const address = yield prisma_1.default.address.findFirst({
            where: { id: shippingAddressId, userId },
        });
        if (!address) {
            res.status(400).json({
                success: false,
                code: "INVALID_ADDRESS",
                message: "Shipping address not found",
            });
            return;
        }
        const order = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const cart = yield tx.cart.findUnique({
                where: { userId },
                include: {
                    items: {
                        include: { product: true },
                    },
                },
            });
            if (!cart || cart.items.length === 0) {
                throw new Error("Your cart is empty");
            }
            for (const item of cart.items) {
                if (item.product.stock < item.quantity) {
                    throw new Error(`Insufficient stock for product ${item.product.name}`);
                }
            }
            let total = 0;
            const orderItems = cart.items.map((item) => {
                const price = item.product.discount
                    ? Number(item.product.price) * (1 - item.product.discount / 100)
                    : Number(item.product.price);
                total += price * item.quantity;
                return {
                    productId: item.productId,
                    quantity: item.quantity,
                    price: parseFloat(price.toFixed(2)),
                };
            });
            total = parseFloat(total.toFixed(2));
            const newOrder = yield tx.order.create({
                data: {
                    userId,
                    orderNumber,
                    paymentMethod: paymentMethod,
                    total,
                    status: client_1.OrderStatus.PROCESSING,
                    shippingAddressId,
                    items: {
                        create: orderItems,
                    },
                },
                include: {
                    items: {
                        include: { product: true },
                    },
                    shippingAddress: true,
                },
            });
            yield Promise.all(cart.items.map((item) => tx.product.update({
                where: { id: item.productId },
                data: { stock: { decrement: item.quantity } },
            })));
            yield tx.cartItem.deleteMany({
                where: { cartId: cart.id },
            });
            return newOrder;
        }));
        try {
            if ((_a = req.user) === null || _a === void 0 ? void 0 : _a.userId) {
                const userData = yield prisma_1.default.user.findUnique({
                    where: { id: req.user.userId },
                });
                if (userData) {
                    yield (0, emailService_1.sendOrderConfirmationEmail)(order, userData);
                }
            }
        }
        catch (error) {
            console.error("Error sending order confirmation email:", error);
        }
        try {
            yield prisma_1.default.notification.create({
                data: {
                    type: "ORDER",
                    title: "Order Placed",
                    message: `Your order #${order.orderNumber} has been placed successfully`,
                    userId,
                },
            });
        }
        catch (error) {
            console.error("Error creating notification:", error);
        }
        res.status(201).json({
            success: true,
            message: "Order placed successfully",
            data: order,
        });
    }
    catch (error) {
        if (error instanceof zod_1.z.ZodError) {
            res.status(400).json({
                success: false,
                errors: error.errors.map((e) => ({
                    path: e.path.join("."),
                    message: e.message,
                })),
            });
            return;
        }
        console.error("Create order error:", error);
        res.status(500).json({
            success: false,
            code: "ORDER_CREATION_FAILED",
            message: error instanceof Error ? error.message : "Failed to create order",
        });
    }
});
exports.createOrder = createOrder;
const getUserOrders = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { page = 1, limit = 10, status } = req.query;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const orders = yield prisma_1.default.order.findMany({
            where: Object.assign({ userId }, (status && { status: status })),
            orderBy: { createdAt: "desc" },
            skip: (Number(page) - 1) * Number(limit),
            take: Number(limit),
            include: {
                items: {
                    include: {
                        product: {
                            include: { images: { where: { isMain: true }, take: 1 } },
                        },
                    },
                },
                shippingAddress: true,
            },
        });
        const total = yield prisma_1.default.order.count({ where: { userId } });
        res.json({
            success: true,
            data: orders,
            pagination: {
                total,
                page: Number(page),
                limit: Number(limit),
                totalPages: Math.ceil(total / Number(limit)),
            },
        });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch orders",
        });
    }
});
exports.getUserOrders = getUserOrders;
const getOrderDetails = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { id } = req.params;
        const userId = req.user.userId;
        const order = yield prisma_1.default.order.findUnique({
            where: { id, userId },
            include: {
                items: {
                    include: {
                        product: {
                            select: { id: true, name: true, images: true, price: true },
                        },
                    },
                },
                shippingAddress: true,
            },
        });
        if (!order) {
            res.status(404).json({
                success: false,
                code: "ORDER_NOT_FOUND",
                message: "Order not found",
            });
            return;
        }
        if (order.userId !== userId) {
            res.status(403).json({
                success: false,
                message: "Not authorized to view this order",
            });
            return;
        }
        res.json({ success: true, data: order });
    }
    catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch order details",
        });
    }
});
exports.getOrderDetails = getOrderDetails;
const cancelOrder = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    try {
        const { id } = req.params;
        const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.userId;
        const order = yield prisma_1.default.$transaction((tx) => __awaiter(void 0, void 0, void 0, function* () {
            const order = yield tx.order.findUnique({
                where: { id, userId },
                include: { items: true },
            });
            if (!order) {
                throw new Error("Order not found");
            }
            if (order.status !== client_1.OrderStatus.PROCESSING) {
                throw new Error("Order cannot be cancelled at this stage");
            }
            const updatedOrder = yield tx.order.update({
                where: { id },
                data: { status: client_1.OrderStatus.CANCELLED },
            });
            yield Promise.all(order.items.map((item) => tx.product.update({
                where: { id: item.productId },
                data: { stock: { increment: item.quantity } },
            })));
            return updatedOrder;
        }));
        if (userId) {
            yield prisma_1.default.notification.create({
                data: {
                    type: "ORDER",
                    title: "Order Cancelled",
                    message: `Your order #${order.orderNumber} has been cancelled`,
                    userId,
                },
            });
        }
    }
    catch (error) {
        res.status(400).json({
            success: false,
            code: "ORDER_CANCELLATION_FAILED",
            message: error instanceof Error ? error.message : "Failed to cancel order",
        });
    }
});
exports.cancelOrder = cancelOrder;
