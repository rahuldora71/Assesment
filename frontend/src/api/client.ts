import type {
  User,
  StudentListItem,
  StudentDetail,
  ActivityEvent,
  TenantMetrics,
  Pagination,
} from "../types/index.js";

const API_BASE_URL = (import.meta.env.VITE_API_URL || "").replace(/\/$/, "");

let currentAccessToken: string | null = localStorage.getItem("srcc_access_token");
let currentRefreshToken: string | null = localStorage.getItem("srcc_refresh_token");

export function setTokens(token: string | null, refreshToken?: string | null) {
  currentAccessToken = token;
  if (token) {
    localStorage.setItem("srcc_access_token", token);
  } else {
    localStorage.removeItem("srcc_access_token");
  }

  if (refreshToken !== undefined) {
    currentRefreshToken = refreshToken;
    if (refreshToken) {
      localStorage.setItem("srcc_refresh_token", refreshToken);
    } else {
      localStorage.removeItem("srcc_refresh_token");
    }
  }
}

export function setAccessToken(token: string | null) {
  setTokens(token);
}

export function getAccessToken(): string | null {
  return currentAccessToken;
}

export function getRefreshToken(): string | null {
  return currentRefreshToken;
}

export class ApiError extends Error {
  status: number;
  code: string;
  requestId?: string;
  fieldErrors?: Record<string, any>;
  currentVersion?: number;

  constructor(
    status: number,
    code: string,
    message: string,
    requestId?: string,
    fieldErrors?: Record<string, any>,
    currentVersion?: number
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.requestId = requestId;
    this.fieldErrors = fieldErrors;
    this.currentVersion = currentVersion;
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (!headers.has("Content-Type") && options.body && typeof options.body === "string") {
    headers.set("Content-Type", "application/json");
  }

  if (currentAccessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${currentAccessToken}`);
  }

  if (!headers.has("x-request-id")) {
    headers.set("x-request-id", `fe-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`);
  }

  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;

  const response = await fetch(url, {
    credentials: "include",
    ...options,
    headers,
  });

  const isJson = response.headers.get("content-type")?.includes("application/json");
  const data = isJson ? await response.json() : null;

  if (!response.ok) {
    const errorDetails = data?.error || data || {};
    throw new ApiError(
      response.status,
      data?.code || errorDetails.code || "REQUEST_FAILED",
      data?.message || errorDetails.message || `Request failed with status ${response.status}`,
      data?.requestId || response.headers.get("x-request-id") || undefined,
      data?.fieldErrors || data?.fields || errorDetails.fields || undefined,
      data?.currentVersion ?? errorDetails.currentVersion
    );
  }

  return data as T;
}

export const api = {
  auth: {
    async register(payload: { tenantName: string; name: string; email: string; password: string }) {
      return request<{ success: boolean; data: { user: User } }>("/api/auth/register", {
        method: "POST",
        body: JSON.stringify(payload),
      });
    },

    async login(payload: { tenantId?: string; email: string; password: string }) {
      const res = await request<{
        success: boolean;
        data: { user: User; accessToken: string; refreshToken?: string };
      }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      setTokens(res.data.accessToken, res.data.refreshToken);
      return res.data;
    },

    async refresh() {
      const headers: Record<string, string> = {};
      if (currentRefreshToken) {
        headers["x-refresh-token"] = currentRefreshToken;
      }
      const res = await request<{
        success: boolean;
        data: { accessToken: string; refreshToken?: string };
      }>("/api/auth/refresh", {
        method: "POST",
        headers,
        body: JSON.stringify({ refreshToken: currentRefreshToken }),
      });
      setTokens(res.data.accessToken, res.data.refreshToken || currentRefreshToken);
      return res.data.accessToken;
    },

    async logout() {
      try {
        await request("/api/auth/logout", { method: "POST" });
      } finally {
        setTokens(null, null);
      }
    },

    async me() {
      const res = await request<{ success: boolean; data: { user: User } }>("/api/auth/me");
      return res.data.user;
    },
  },

  students: {
    async list(params: {
      q?: string;
      status?: string;
      sortBy?: string;
      sortOrder?: "asc" | "desc";
      page?: number;
      limit?: number;
    }) {
      const query = new URLSearchParams();
      if (params.q) query.set("q", params.q);
      if (params.status && params.status !== "ALL") query.set("status", params.status);
      if (params.sortBy) query.set("sortBy", params.sortBy);
      if (params.sortOrder) query.set("sortOrder", params.sortOrder);
      if (params.page) query.set("page", String(params.page));
      if (params.limit) query.set("limit", String(params.limit));

      const res = await request<{
        success: boolean;
        data: {
          items: StudentListItem[];
          pagination: Pagination;
        };
      }>(`/api/students?${query.toString()}`);

      return res.data;
    },

    async getById(id: string) {
      const res = await request<{
        success: boolean;
        data: {
          student: StudentDetail;
        };
      }>(`/api/students/${id}`);
      return res.data.student;
    },

    async create(payload: { name: string; email: string }) {
      const res = await request<{
        success: boolean;
        data: {
          student: StudentListItem;
        };
      }>("/api/students", {
        method: "POST",
        body: JSON.stringify(payload),
      });
      return res.data.student;
    },

    async update(id: string, payload: { name?: string; email?: string; version: number }) {
      const res = await request<{
        success: boolean;
        data: {
          student: StudentListItem;
        };
      }>(`/api/students/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      return res.data.student;
    },

    async createAttempt(
      id: string,
      payload: { competency: string; score: number },
      idempotencyKey: string
    ) {
      const res = await request<{
        success: boolean;
        data: {
          attempt: any;
          student: StudentListItem;
          readiness: any;
        };
      }>(`/api/students/${id}/attempts`, {
        method: "POST",
        headers: {
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify(payload),
      });
      return res.data;
    },

    async getActivity(id: string, page = 1, limit = 20) {
      const res = await request<{
        success: boolean;
        data: {
          items: ActivityEvent[];
          pagination: Pagination;
        };
      }>(`/api/students/${id}/activity?page=${page}&limit=${limit}`);
      return res.data;
    },

    async getAggregation() {
      const res = await request<{
        success: boolean;
        data: TenantMetrics[];
      }>("/api/students/activity/aggregation");
      return res.data;
    },
  },
};
