import { notificationsApi } from '@/db/api';

export const notificationHelper = {
  // Notify user about their action
  notifyUser: async (
    userId: string,
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning',
    actionType: string,
    resourceType?: string,
    resourceId?: string
  ) => {
    try {
      await notificationsApi.create({
        user_id: userId,
        title,
        message,
        type,
        action_type: actionType,
        resource_type: resourceType,
        resource_id: resourceId,
      });
    } catch (error) {
      console.error('Failed to create notification:', error);
    }
  },

  // Notify all admins
  notifyAdmins: async (
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning',
    actionType: string,
    resourceType?: string,
    resourceId?: string
  ) => {
    try {
      await notificationsApi.notifyAllAdmins({
        title,
        message,
        type,
        action_type: actionType,
        resource_type: resourceType,
        resource_id: resourceId,
      });
    } catch (error) {
      console.error('Failed to notify admins:', error);
    }
  },

  // Notify both user and admins
  notifyUserAndAdmins: async (
    userId: string,
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning',
    actionType: string,
    resourceType?: string,
    resourceId?: string
  ) => {
    await Promise.all([
      notificationHelper.notifyUser(userId, title, message, type, actionType, resourceType, resourceId),
      notificationHelper.notifyAdmins(title, message, type, actionType, resourceType, resourceId),
    ]);
  },
};
