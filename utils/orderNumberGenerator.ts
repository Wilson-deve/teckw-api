export const generateOrderNumber = async (prisma: any) => {
  const today = new Date();

  const datePart = today.toISOString().slice(0, 10).replace(/-/g, ""); // '20250426'

  // Count how many orders were created today
  const todayStart = new Date(today.setHours(0, 0, 0, 0));
  const todayEnd = new Date(today.setHours(23, 59, 59, 999));

  const todayOrdersCount = await prisma.order.count({
    where: {
      createdAt: {
        gte: todayStart,
        lte: todayEnd,
      },
    },
  });

  const sequenceNumber = (todayOrdersCount + 1).toString().padStart(4, "0"); // '0001'

  return `ORD-${datePart}-${sequenceNumber}`;
};
