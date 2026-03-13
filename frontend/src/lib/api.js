import axios from 'axios';

const api = axios.create({
  withCredentials: true,
});

let unauthorizedHandler = null;

export const setUnauthorizedHandler = (handler) => {
  unauthorizedHandler = typeof handler === 'function' ? handler : null;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (
      error?.response?.status === 401 &&
      !error?.config?.skipAuthRedirect &&
      unauthorizedHandler
    ) {
      unauthorizedHandler();
    }
    return Promise.reject(error);
  }
);

export default api;
