"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.categoryRoutes = void 0;
const express_1 = require("express");
const category_1 = require("../controllers/category");
const auth_1 = require("../middleware/auth");
const client_1 = require("@prisma/client");
const router = (0, express_1.Router)();
router
    .route("/")
    .get(category_1.getCategories)
    .post(auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN), category_1.createCategory);
router
    .route("/:id")
    .get(category_1.getCategoryById)
    .put(auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN), category_1.updateCategory)
    .delete(auth_1.authenticate, (0, auth_1.authorize)(client_1.Role.ADMIN), category_1.deleteCategory);
exports.categoryRoutes = router;
