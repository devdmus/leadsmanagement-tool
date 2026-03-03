import { notificationsApi } from '@/db/api';

export const notificationHelper = {
  // Helper to namespace IDs
  namespaceId: (id: string, type: 'sa' | 'wp' = 'wp') => {
    if (!id) return '';
    id = id.toString();
    if (id.startsWith('sa_') || id.startsWith('wp_')) return id;
    return `${type}_${id}`;
  },

  // Notify a specific user. Default to 'wp' prefix unless specified.
  notifyUser: async (
    userId: string,
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning',
    actionType: string,
    resourceType?: string,
    resourceId?: string,
    userPrefix: 'sa' | 'wp' = 'wp'
  ) => {
    try {
      await notificationsApi.create({
        user_id: notificationHelper.namespaceId(userId, userPrefix),
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

  // Notify all admins (broadcasts one notification to every admin/super-admin).
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

  // Notify a specific user AND all admins (useful for assignments).
  // This sets user_id for the user and role_target='admin' for the admins.
  notifyAssignment: async (
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
        user_id: notificationHelper.namespaceId(userId, 'wp'),
        role_target: 'admin', // Ensures admins also see it
        title,
        message,
        type,
        action_type: actionType,
        resource_type: resourceType,
        resource_id: resourceId,
      });
    } catch (error) {
      console.error('Failed to create assignment notification:', error);
    }
  },

  // Notify admins about an action.
  notifyUserAndAdmins: async (
    _userId: string,
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning',
    actionType: string,
    resourceType?: string,
    resourceId?: string
  ) => {
    await notificationHelper.notifyAdmins(title, message, type, actionType, resourceType, resourceId);
  },
};
