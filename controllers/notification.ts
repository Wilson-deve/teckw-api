import { RequestHandler } from "express";
import prisma from "../lib/prisma";

export const getNotifications: RequestHandler = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;

    const notifications = await prisma.notification.findMany({
      where: { userId: req.user!.userId },
      orderBy: { createdAt: "desc" },
      skip: (Number(page) - 1) * Number(limit),
      take: Number(limit),
    });

    const total = await prisma.notification.count({
      where: { userId: req.user!.userId },
    });

    res.json({
      success: true,
      data: notifications,
      pagination: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to get notifications" });
  }
};

export const markAsRead: RequestHandler = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.notification.updateMany({
      where: {
        id,
        userId: req.user!.userId,
      },
      data: {
        isRead: true,
      },
    });

    res.json({ success: true, message: "Notification marked as read" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to mark notification as read",
    });
  }
};

export const markAllAsRead: RequestHandler = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: { userId: req.user!.userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true, message: "All notifications marked as read" });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Failed to mark all notifications as read",
    });
  }
};
