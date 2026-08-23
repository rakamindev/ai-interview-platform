import axios from "axios";
import {clearToken, getStoredToken} from "@/stores/authAtom";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000/api/v1";
const WS_BASE_URL = import.meta.env.VITE_WS_BASE_URL ?? "ws://localhost:3000";
const DEBUG = import.meta.env.VITE_DEBUG === "true";
export const WS_URL = WS_BASE_URL;

export const api = axios.create({
    baseURL: BASE_URL,
    headers: {"Content-Type": "application/json"},
});

api.interceptors.request.use((config) => {
    const token = getStoredToken();
    if (token) config.headers.Authorization = `Bearer ${token}`;
    if (DEBUG) {
        console.log("Request:", config.method?.toUpperCase(), config.url);
        console.log("Body:", config.data);
    }

    return config;
});

// Unwrap backend envelope: { data: { ... } } → { ... }
// On 401/403, clear stored credentials and redirect to login.
api.interceptors.response.use(
    (response) => {
        if (DEBUG && response.config.method?.toLowerCase() === "get") {
            console.log(
                "Response:",
                response.config.method?.toUpperCase(),
                response.config.url
            );
            console.log("Data:", response.data);
        }

        if (
            response.data &&
            typeof response.data === "object" &&
            "data" in response.data
        ) {
            response.data = response.data.data;
        }

        return response;
    },
    (error) => {
        if (error.response?.status === 401 || error.response?.status === 403) {
            clearToken();
            window.location.href = "/login";
        }

        return Promise.reject(error);
    }
);

export default api;
