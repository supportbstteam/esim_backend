// import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
// // import { getValidToken } from "../services/token.service";

// const apiClient: AxiosInstance = axios.create({
//   timeout: 10000, // no baseURL, you will pass full URLs
// });

// // Request interceptor → inject token
// apiClient.interceptors.request.use(
//   async (config: any) => {
//     const token = await getValidToken();
//     if (token) {
//       config.headers = {
//         ...config.headers,
//         Authorization: `Bearer ${token}`,
//         Accept: "application/json",
//         "Content-Type": "application/json",
//       };
//     }
//     return config;
//   },
//   (error) => Promise.reject(error)
// );

// // Response interceptor → handle errors globally
// apiClient.interceptors.response.use(
//   (response: AxiosResponse) => response,
//   (error) => {
//     console.error("API error:", error.response?.data || error.message);
//     return Promise.reject(error);
//   }
// );

// export default apiClient;
