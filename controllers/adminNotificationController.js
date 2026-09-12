const { getUnreadCounts, markNotificationsRead } = require("../services/adminNotificationService");

const getNotificationCounts = async (req, res, next) => {
  try {
    res.json(await getUnreadCounts());
  } catch (error) {
    next(error);
  }
};

const readNotifications = async (req, res, next) => {
  try {
    const allowedTypes = ["NEW_ORDER", "NEW_CUSTOMER", "SUPPORT_TICKET", "LIVE_SUPPORT_MESSAGE"];
    const requestedTypes = Array.isArray(req.body.types) ? req.body.types : [];
    const types = requestedTypes.filter((type) => allowedTypes.includes(type));
    res.json({ counts: await markNotificationsRead(types) });
  } catch (error) {
    next(error);
  }
};

module.exports = { getNotificationCounts, readNotifications };
