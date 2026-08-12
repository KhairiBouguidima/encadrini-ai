export type UserRole = "STUDENT" | "ENCADRER" | "ADMIN"

export interface User {
  id: string
  email: string
  first_name: string
  last_name: string
  faculty: string
  gender: string
  phone_number: string
  role: UserRole
  is_active: boolean
}

export interface TokenResponse {
  access_token: string
  refresh_token: string
  token_type: string
  user: User
}

export type AIAnalysisStatus = "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED"

export interface ReportVersion {
  version_number: number
  original_file_name: string
  original_mime_type: string
  file_size: number
  uploaded_at: string
  ai_analysis_status: AIAnalysisStatus
}

export interface ReportHistory {
  id: string
  project_id: string
  current_version: number
  versions: ReportVersion[]
  created_at: string
}

export interface Project {
  id: string
  student_id: string
  encadrer_id: string | null
  title: string
  description: string
  status: string
  created_at: string
}

export interface Annotation {
  id: string
  report_id: string
  version_number: number
  page_number: number
  author_id: string
  content: string
  created_at: string
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1"
const ACCESS_TOKEN_KEY = "encadrini_access_token"
const REFRESH_TOKEN_KEY = "encadrini_refresh_token"
const USER_KEY = "encadrini_user"

function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  const token = getAccessToken()

  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  if (!response.ok) {
    let message = "Erreur de communication avec le serveur."
    try {
      const payload = await response.json()
      message = payload.detail ?? message
    } catch {
      message = response.statusText || message
    }
    throw new Error(message)
  }

  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

export function saveSession(payload: TokenResponse) {
  localStorage.setItem(ACCESS_TOKEN_KEY, payload.access_token)
  localStorage.setItem(REFRESH_TOKEN_KEY, payload.refresh_token)
  localStorage.setItem(USER_KEY, JSON.stringify(payload.user))
}

export function clearSession() {
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
  localStorage.removeItem(USER_KEY)
}

export function getStoredUser(): User | null {
  const raw = localStorage.getItem(USER_KEY)
  if (!raw) return null

  try {
    return JSON.parse(raw) as User
  } catch {
    clearSession()
    return null
  }
}

export const api = {
  login(email: string, password: string) {
    return request<TokenResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    })
  },
  register(user: {
    email: string
    password: string
    first_name: string
    last_name: string
    faculty: string
    gender: string
    phone_number: string
    role: UserRole
  }) {
    return request<User>("/auth/register", {
      method: "POST",
      body: JSON.stringify(user),
    })
  },
  confirmEmail(token: string) {
    return request<{ message: string }>(`/auth/confirm-email?token=${encodeURIComponent(token)}`)
  },
  me() {
    return request<User>("/auth/me")
  },
  getMyProject() {
    return request<Project>("/projects/me")
  },
  getReportHistory() {
    return request<ReportHistory>("/reports/history")
  },
  uploadReport(file: File) {
    const body = new FormData()
    body.append("file", file)
    return request<ReportHistory>("/reports/upload", { method: "POST", body })
  },
  getAnnotations(reportId: string, versionNumber: number) {
    return request<Annotation[]>(`/annotations/reports/${reportId}/version/${versionNumber}`)
  },
  createAnnotation(reportId: string, versionNumber: number, pageNumber: number, content: string) {
    return request<Annotation>(`/annotations/reports/${reportId}`, {
      method: "POST",
      body: JSON.stringify({ version_number: versionNumber, page_number: pageNumber, content }),
    })
  },
  getDownloadUrl(versionNumber: number) {
    return `${API_BASE_URL}/reports/download/${versionNumber}`
  },
  getAuthHeaders() {
    const token = getAccessToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  },
}
