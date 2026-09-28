import { getApiBaseUrl } from '../../../config/api';

const getBaseUrl = () => getApiBaseUrl();

export const USER_ENDPOINTS = {
  USERS: () => `${getBaseUrl()}/api/users`,
  USER_DETAIL: (id) => `${getBaseUrl()}/api/users/${id}`,
  USER_PASSWORD: (id) => `${getBaseUrl()}/api/users/${id}/password`,
  USER_STATUS: (id) => `${getBaseUrl()}/api/users/${id}/status`,
};
