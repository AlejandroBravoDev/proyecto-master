import { getApiBaseUrl } from '../../../config/api';

export const AUTH_ENDPOINTS = {
  get LOGIN() { return `${getApiBaseUrl()}/api/auth/login`; },
  get ME() { return `${getApiBaseUrl()}/api/auth/me`; },
};
