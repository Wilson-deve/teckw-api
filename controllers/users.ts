import { RequestHandler } from "express";
import bcrypt from "bcryptjs";
import prisma from "../lib/prisma";
import { updateUserSchema, userResponseSchema } from "../types";

export const getUserProfile: RequestHandler = async (req, res) => {
  try {
    const userId = req.params.id;
    const authenticatedUserId = req.user?.userId;

    if (userId !== authenticatedUserId) {
      res.status(403).json({
        success: false,
        message: "Unauthorized to update this profile",
      });
      return;
    }

    const user = await prisma.user.findUnique({
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

    const response = userResponseSchema.parse(user);

    res.status(200).json({
      success: true,
      data: response,
    });
  } catch (error) {
    console.error("Get user error:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateUserProfile: RequestHandler = async (req, res) => {
  try {
    const userId = req.params.id;
    const authenticatedUserId = req.user?.userId;

    if (userId !== authenticatedUserId) {
      res.status(403).json({
        success: false,
        code: "UNAUTHORIZED",
        message: "Unauthorized to update this profile",
      });
      return;
    }

    const updateData = updateUserSchema.parse(req.body);

    const updatedUser = await prisma.user.update({
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
  } catch (error) {
    console.error("Update error:", error);
    res.status(500).json({
      status: "error",
      code: 500,
      message:
        error instanceof Error ? error.message : "Failed to update profile",
    });
    return;
  }
};

export const deleteUserAccount: RequestHandler = async (req, res) => {
  try {
    const userId = req.params.id;
    const { password } = req.body;
    const authenticatedUserId = req.user?.userId;

    if (userId !== authenticatedUserId) {
      res.status(403).json({
        success: false,
        message: "Unauthorized to delete this account",
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: "Invalid password",
      });
      return;
    }

    const deletedEmail = `deleted-${Date.now()}-${userId}@deleted.com`;
    const deletedUsername = `deleted-${Date.now()}-${userId}`;

    await prisma.user.update({
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
  } catch (error) {
    console.error("Delete user error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete account",
    });
  }
};

export const uploadAvatar: RequestHandler = async (req, res) => {};
