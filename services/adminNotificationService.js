const AdminNotification = require("../models/AdminNotification");

let ioInstance = null;

const setNotificationIo = (io) => {
  ioInstance = io;
};

const getUnreadCounts = async () => {
  const grouped = await AdminNotification.aggregate([
    { $match: { isRead: false } },
    { $group: { _id: "$type", count: { $sum: 1 } } },
  ]);

  const counts = { users: 0, orders: 0, support: 0, liveSupport: 0 };
  const typeToKey = {
    NEW_CUSTOMER: "users",
    NEW_ORDER: "orders",
    SUPPORT_TICKET: "support",
    LIVE_SUPPORT_MESSAGE: "liveSupport",
  };

  grouped.forEach(({ _id, count }) => {
    const key = typeToKey[_id];
    if (key) counts[key] = count;
  });

  return { ...counts, total: Object.values(counts).reduce((sum, count) => sum + count, 0) };
};

const emitNotificationCounts = async () => {
  if (!ioInstance) return null;
  try {
    const counts = await getUnreadCounts();
    ioInstance.to("admins").emit("admin:notification-counts", counts);
    return counts;
  } catch (_) {
    return null;
  }
};

const createAdminNotification = async ({ type, title, message, relatedId, relatedType, skipIfAdminViewing }) => {
  try {
    if (skipIfAdminViewing && ioInstance) {
      const adminSockets = ioInstance.sockets.adapter.rooms.get(`support:${skipIfAdminViewing}`);
      const hasAdminViewer = adminSockets && [...adminSockets].some((socketId) => {
        const connectedSocket = ioInstance.sockets.sockets.get(socketId);
        return connectedSocket?.user?.role === "Admin";
      });
      if (hasAdminViewer) return null;
    }

    const notification = await AdminNotification.create({ type, title, message, relatedId: relatedId || null, relatedType: relatedType || null });
    const counts = await emitNotificationCounts();
    if (ioInstance) {
      ioInstance.to("admins").emit("admin:notification", { notification, counts });
    }
    return notification;
  } catch (_) {
    return null;
  }
};

const markNotificationsRead = async (types = []) => {
  const filter = { isRead: false };
  if (types.length) filter.type = { $in: types };
  await AdminNotification.updateMany(filter, { $set: { isRead: true } });
  const counts = await getUnreadCounts();
  if (ioInstance) ioInstance.to("admins").emit("admin:notification-counts", counts);
  return counts;
};

module.exports = {
  setNotificationIo,
  getUnreadCounts,
  emitNotificationCounts,
  createAdminNotification,
  markNotificationsRead,
};
