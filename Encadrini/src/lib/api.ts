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
  openai_api_key?: string
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
  title: string
  report_type: string
  description?: string
  current_version: number
  versions: ReportVersion[]
  created_at: string
  updated_at?: string
}

export interface Project {
  id: string
  student_id: string
  encadrer_id: string | null
  encadrer_ids?: string[]
  encadrer_name?: string | null
  encadrer_email?: string | null
  student_name?: string | null
  student_email?: string | null
  title: string
  description: string
  status: string
  progress: number
  deadline?: string | null
  tags: string[]
  academic_year?: string
  created_at: string
  updated_at?: string
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

export interface RoadmapItem {
  id: string
  title: string
  description: string
  priority: "critical" | "important" | "minor"
  dimension: "structure" | "methodology" | "language" | "formatting" | "citations"
  estimated_gain: number
  estimated_effort: string
  completed: boolean
}

export interface DimensionScores {
  structure: number
  methodology: number
  language: number
  formatting: number
  citations: number
}

export interface AIAnalysisResponse {
  status: AIAnalysisStatus
  report_id: string
  version_number: number
  scores: {
    linguistic: number
    structural: number
    coherence: number
    overall_quality: number
  } | null
  readiness_score?: number
  readiness_level?: string
  dimension_scores?: DimensionScores | null
  missing_sections: string[]
  corrections: {
    page: number | null
    original: string
    suggestion: string
    explanation: string
  }[]
  generated_content: {
    summary: string
    abstract: string
    keywords: string[]
    jury_questions: string[]
    formatting_issues?: string[]
  } | null
  roadmap?: RoadmapItem[]
}

export interface AdminUser {
  id: string
  email: string
  role: UserRole
  first_name: string
  last_name: string
  faculty: string
  is_active: boolean
  created_at: string
}

export interface AdminUserListResponse {
  users: AdminUser[]
  total: number
  page: number
  page_size: number
}

export interface AdminProject {
  id: string
  title: string
  student_email: string | null
  encadrer_email: string | null
  report_count: number
  latest_version: number | null
  created_at: string
}

export interface AdminProjectListResponse {
  projects: AdminProject[]
  total: number
  page: number
  page_size: number
}

export interface PlatformStats {
  total_users: number
  total_students: number
  total_encadrers: number
  total_admins: number
  active_users: number
  total_projects: number
  total_reports: number
  total_report_versions: number
  total_annotations: number
  total_ai_analyses: number
  ai_analysis_avg_quality: number | null
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000/api/v1"
const ACCESS_TOKEN_KEY = "encadrini_access_token"
const REFRESH_TOKEN_KEY = "encadrini_refresh_token"
const USER_KEY = "encadrini_user"
export const SESSION_EXPIRED_EVENT = "encadrini_session_expired"

export function getAccessToken() {
  return localStorage.getItem(ACCESS_TOKEN_KEY)
}

async function request<T>(path: string, options: RequestInit = {}, isRetry = false): Promise<T> {
  const headers = new Headers(options.headers)
  const token = getAccessToken()

  if (token) headers.set("Authorization", `Bearer ${token}`)
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  if (!response.ok) {
    if (response.status === 401 && token && !isRetry && path !== "/auth/refresh") {
      const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY)
      if (refreshToken) {
        try {
          const payload = await api.refreshToken(refreshToken)
          saveSession(payload)
          // Retry the original request
          return request<T>(path, options, true)
        } catch (err) {
          clearSession()
          window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
          throw new Error("Session expirée. Veuillez vous reconnecter.")
        }
      }
    }

    let message = "Erreur de communication avec le serveur."
    try {
      const payload = await response.json()
      message = payload.detail ?? message
    } catch {
      message = response.statusText || message
    }
    if (response.status === 401 && token) {
      clearSession()
      window.dispatchEvent(new Event(SESSION_EXPIRED_EVENT))
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
    faculty?: string
    gender?: string
    phone_number?: string
    role?: UserRole
  }) {
    return request<TokenResponse>("/auth/register", {
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
  refreshToken(refresh_token: string) {
    // using raw fetch to avoid interceptor loop, but we added path bypass in interceptor so it's fine.
    // However, it's a POST and doesn't need Bearer token since it sends refresh token in body.
    return request<TokenResponse>("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refresh_token })
    })
  },
  forgotPassword(email: string) {
    return request<{ message: string }>("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email })
    })
  },
  resetPassword(token: string, new_password: string) {
    return request<{ message: string }>("/auth/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, new_password })
    })
  },
  changePassword(current_password: string, new_password: string) {
    return request<{ message: string }>("/auth/change-password", {
      method: "POST",
      body: JSON.stringify({ current_password, new_password })
    })
  },
  resendConfirmation(email: string) {
    return request<{ message: string }>("/auth/resend-confirmation", {
      method: "POST",
      body: JSON.stringify({ email })
    })
  },
  logout() {
    return request<{ message: string }>("/auth/logout", {
      method: "POST",
    })
  },
  getMyProject() {
    return request<Project>("/projects/me")
  },
  createProject(title: string, description: string, tags: string[] = [], deadline?: string) {
    return request<Project>("/projects/", {
      method: "POST",
      body: JSON.stringify({ title, description, tags, deadline }),
    })
  },
  updateMyProject(payload: Partial<Project>) {
    return request<Project>("/projects/me", {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
  },
  getReports(projectId?: string) {
    const query = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""
    return request<ReportHistory[]>(`/reports/${query}`)
  },
  getReport(reportId: string) {
    return request<ReportHistory>(`/reports/${reportId}`)
  },
  createReport(data: { title: string; report_type: string; description?: string; file?: File }) {
    const body = new FormData()
    body.append("title", data.title)
    body.append("report_type", data.report_type)
    if (data.description) body.append("description", data.description)
    if (data.file) body.append("file", data.file)
    return request<ReportHistory>("/reports/", { method: "POST", body })
  },
  uploadReportTo(reportId: string, file: File) {
    const body = new FormData()
    body.append("file", file)
    return request<ReportHistory>(`/reports/${reportId}/upload`, { method: "POST", body })
  },
  deleteReport(reportId: string) {
    return request<void>(`/reports/${reportId}`, { method: "DELETE" })
  },
  previewInvitation(token: string) {
    return request<{
      token: string
      project_id: string
      student_id: string
      student_name: string
      project_title: string
      project_description: string
      encadrer_email: string
      status: string
      expires_at: string
    }>(`/projects/invitations/preview?token=${encodeURIComponent(token)}`)
  },
  acceptInvitation(token: string) {
    return request<Project>(`/projects/invitations/accept?token=${encodeURIComponent(token)}`, {
      method: "POST",
    })
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
  getAIAnalysis(reportId: string, versionNumber: number) {
    return request<AIAnalysisResponse>(`/ai/reports/${reportId}/version/${versionNumber}`)
  },
  getAdminStats() {
    return request<PlatformStats>("/admin/stats")
  },
  getAdminUsers(search = "") {
    const query = search ? `?search=${encodeURIComponent(search)}` : ""
    return request<AdminUserListResponse>(`/admin/users${query}`)
  },
  getAdminProjects(search = "") {
    const query = search ? `?search=${encodeURIComponent(search)}` : ""
    return request<AdminProjectListResponse>(`/admin/projects${query}`)
  },
  updateAdminUser(userId: string, payload: Partial<Pick<AdminUser, "is_active" | "role" | "faculty">>) {
    return request<AdminUser>(`/admin/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(payload),
    })
  },
  updateMe(payload: { first_name?: string; last_name?: string; faculty?: string; phone_number?: string; openai_api_key?: string }) {
    return request<User>("/auth/me", {
      method: "PUT",
      body: JSON.stringify(payload),
    })
  },
  inviteSupervisor(encadrer_email: string) {
    return request<{ id: string; invitation_link: string; email_sent: boolean }>("/projects/invite", {
      method: "POST",
      body: JSON.stringify({ encadrer_email }),
    })
  },
  getDownloadUrl(versionNumber: number, reportId?: string) {
    const q = reportId ? `?report_id=${encodeURIComponent(reportId)}` : ""
    return `${API_BASE_URL}/reports/download/${versionNumber}${q}`
  },
  getNotifications() {
    return request<{
      notifications: {
        id: string
        type: string
        title: string
        message: string
        is_read: boolean
        link?: string
        created_at: string
      }[]
      unread_count: number
      total: number
    }>("/notifications/")
  },
  markNotificationRead(id: string) {
    return request<{ status: string }>(`/notifications/${id}/read`, { method: "PATCH" })
  },
  markAllNotificationsRead() {
    return request<{ status: string }>("/notifications/read-all", { method: "PATCH" })
  },
  getAuthHeaders(): Record<string, string> {
    const token = getAccessToken()
    return token ? { Authorization: `Bearer ${token}` } : {}
  },
  chatWithAgent(report_id: string, version_number: number, messages: { role: string; content: string }[]) {
    return request<{ reply: string }>("/ai/chat", {
      method: "POST",
      body: JSON.stringify({ report_id, version_number, messages }),
    })
  },
  checkAIContent(text: string) {
    return request<{ ai_score: number; label: string; rewritten: string | null }>("/ai/check-ai", {
      method: "POST",
      body: JSON.stringify({ text }),
    })
  },
}
