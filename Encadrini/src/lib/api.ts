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
  subscription_plan?: "FREE" | "PREMIUM"
  monthly_simulations_count?: number
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

export type SupervisorRole = "ACADEMIC" | "ENTERPRISE"

export interface StudentInfo {
  id: string
  name: string
  email: string
  faculty?: string
  is_owner: boolean
}

export interface EncadrerInfo {
  id: string
  name: string
  email: string
  faculty?: string
  role?: SupervisorRole
}

export interface ProjectTask {
  id: string
  title: string
  description?: string
  assigned_to?: string | null
  assigned_name?: string | null
  status: "TODO" | "IN_PROGRESS" | "DONE"
  due_date?: string | null
  created_at: string
  completed_at?: string | null
}

export interface ProjectActivity {
  id: string
  user_id?: string | null
  user_name: string
  user_role: string
  action: string
  details: string
  created_at: string
}

export interface InvitationItem {
  id: string
  project_id: string
  student_id: string
  student_name?: string
  invitation_type?: "SUPERVISOR" | "BINOME"
  supervisor_role?: SupervisorRole | null
  recipient_email?: string
  encadrer_email: string
  status: "PENDING" | "ACCEPTED" | "DECLINED" | "EXPIRED"
  invitation_link?: string | null
  expires_at: string
  created_at: string
}

export interface PendingSupervisorInvitation {
  token?: string | null
  invitation_id: string
  project_id: string
  student_id: string
  student_name: string
  project_title: string
  project_description: string
  invitation_type?: "SUPERVISOR" | "BINOME"
  supervisor_role?: SupervisorRole | null
  recipient_email?: string
  encadrer_email: string
  status: string
  expires_at: string
  created_at?: string
}

export interface Project {
  id: string
  student_id: string
  co_student_id?: string | null
  student_ids?: string[]
  students?: StudentInfo[]
  co_student_name?: string | null
  co_student_email?: string | null
  co_student_faculty?: string | null
  is_binome?: boolean
  encadrer_id: string | null
  encadrer_ids?: string[]
  encadrers?: EncadrerInfo[]
  academic_encadrer_id?: string | null
  academic_encadrer?: EncadrerInfo | null
  enterprise_encadrer_id?: string | null
  enterprise_encadrer?: EncadrerInfo | null
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
  tasks?: ProjectTask[]
  activities?: ProjectActivity[]
  created_at: string
  updated_at?: string
}

export type ApprovalStatus =
  | "PENDING_REVIEW"
  | "CORRECTIONS_REQUIRED"
  | "APPROVED_FOR_DEFENSE"
  | "REJECTED"

export interface Annotation {
  id: string
  report_id: string
  version_number: number
  page_number: number
  author_id: string
  author_name?: string | null
  author_role?: string | null
  content: string
  selected_text?: string | null
  x?: number | null
  y?: number | null
  width?: number | null
  height?: number | null
  created_at: string
  updated_at?: string | null
}

export interface Evaluation {
  id: string
  report_id: string
  version_number: number
  encadrer_id: string
  encadrer_name?: string | null
  encadrer_email?: string | null
  supervisor_role?: SupervisorRole
  grade: number
  feedback?: string | null
  approval_status: ApprovalStatus
  criteria_ratings?: Record<string, number>
  created_at: string
  updated_at: string
}


export interface DualValidationVersionStatus {
  report_id: string
  version_number: number
  workflow_status: "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "CHANGES_REQUESTED" | "APPROVED" | "REJECTED"
  requires_academic: boolean
  requires_enterprise: boolean
  academic_evaluation?: Evaluation | null
  enterprise_evaluation?: Evaluation | null
  academic_approved: boolean
  enterprise_approved: boolean
  is_fully_approved: boolean
  requires_changes: boolean
  summary_message: string
  evaluations?: Evaluation[]
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

export interface AdminUserCreatePayload {
  email: string
  password: string
  role: UserRole
  first_name: string
  last_name: string
  faculty?: string
  is_active?: boolean
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
  co_student_email?: string | null
  encadrer_email: string | null
  academic_encadrer_email?: string | null
  enterprise_encadrer_email?: string | null
  is_binome?: boolean
  report_count: number
  latest_version: number | null
  workflow_status?: string | null
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

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "https://encadrini-ai.onrender.com/api/v1"
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

async function requestBlob(path: string, options: RequestInit = {}): Promise<Blob> {
  const headers = new Headers(options.headers)
  const token = getAccessToken()
  if (token) headers.set("Authorization", `Bearer ${token}`)
  const response = await fetch(`${API_BASE_URL}${path}`, { ...options, headers })
  if (!response.ok) {
    let message = "Erreur de téléchargement du fichier."
    try {
      const payload = await response.json()
      message = payload.detail ?? message
    } catch {
      message = response.statusText || message
    }
    throw new Error(message)
  }
  return response.blob()
}

export function triggerBlobDownload(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
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
  getMyProject(projectId?: string) {
    const q = projectId ? `?project_id=${encodeURIComponent(projectId)}` : ""
    return request<Project>(`/projects/me${q}`)
  },
  getSupervisedProjects() {
    return request<Project[]>("/projects/supervised")
  },
  getProjectInvitations() {
    return request<InvitationItem[]>("/projects/invitations")
  },
  cancelInvitation(invitationId: string) {
    return request<{ status: string; message: string }>(`/projects/invitations/${invitationId}`, {
      method: "DELETE",
    })
  },
  removeEncadrer(encadrerId: string) {
    return request<Project>(`/projects/encadrers/${encadrerId}`, {
      method: "DELETE",
    })
  },
  getSupervisorPendingInvitations() {
    return request<PendingSupervisorInvitation[]>("/projects/invitations/pending")
  },
  acceptInvitationById(invitationId: string) {
    return request<Project>(`/projects/invitations/${invitationId}/accept`, {
      method: "POST",
    })
  },
  declineInvitationById(invitationId: string) {
    return request<{ status: string; message: string }>(`/projects/invitations/${invitationId}/decline`, {
      method: "POST",
    })
  },
  declineInvitation(token: string) {
    return request<{ status: string; message: string }>(`/projects/invitations/decline?token=${encodeURIComponent(token)}`, {
      method: "POST",
    })
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
      invitation_id?: string
      project_id: string
      student_id: string
      student_name: string
      project_title: string
      project_description?: string
      invitation_type?: "SUPERVISOR" | "BINOME"
      supervisor_role?: SupervisorRole | null
      encadrer_email: string
      recipient_email?: string
      status: string
      expires_at: string
      created_at?: string
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
  createAnnotation(reportId: string, versionNumber: number, pageNumber: number, content: string, extra?: {
    selected_text?: string; x?: number; y?: number; width?: number; height?: number
  }) {
    return request<Annotation>(`/annotations/reports/${reportId}`, {
      method: "POST",
      body: JSON.stringify({
        version_number: versionNumber,
        page_number: pageNumber,
        content,
        ...(extra ?? {}),
      }),
    })
  },
  updateAnnotation(annotationId: string, content: string) {
    return request<Annotation>(`/annotations/${annotationId}`, {
      method: "PATCH",
      body: JSON.stringify({ content }),
    })
  },
  deleteAnnotation(annotationId: string) {
    return request<void>(`/annotations/${annotationId}`, { method: "DELETE" })
  },
  async getEvaluation(reportId: string, versionNumber: number): Promise<Evaluation | null> {
    // Returns null (not throws) when no evaluation exists yet (404).
    // This avoids spurious console errors in React StrictMode.
    const token = getAccessToken()
    const headers: Record<string, string> = { "Content-Type": "application/json" }
    if (token) headers["Authorization"] = `Bearer ${token}`
    const res = await fetch(`${API_BASE_URL}/evaluations/reports/${reportId}/version/${versionNumber}`, { headers })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`Erreur évaluation: ${res.status}`)
    return res.json() as Promise<Evaluation>
  },
  inviteEncadrer(encadrer_email: string, role: SupervisorRole = "ACADEMIC") {
    return request<InvitationItem>("/projects/invite", {
      method: "POST",
      body: JSON.stringify({ encadrer_email, role }),
    })
  },
  inviteSupervisor(encadrer_email: string, role: SupervisorRole = "ACADEMIC") {
    return request<InvitationItem>("/projects/invite", {
      method: "POST",
      body: JSON.stringify({ encadrer_email, role }),
    })
  },
  inviteBinome(email: string) {
    return request<InvitationItem>("/projects/binome/invite", {
      method: "POST",
      body: JSON.stringify({ email }),
    })
  },
  removeBinome() {
    return request<Project>("/projects/binome", {
      method: "DELETE",
    })
  },
  getPendingBinomeInvitations() {
    return request<PendingSupervisorInvitation[]>("/projects/invitations/pending/binome")
  },
  acceptBinomeInvitation(invitationId: string) {
    return request<Project>(`/projects/invitations/binome/${invitationId}/accept`, {
      method: "POST",
    })
  },
  declineBinomeInvitation(invitationId: string) {
    return request<{ status: string; message: string }>(`/projects/invitations/binome/${invitationId}/decline`, {
      method: "POST",
    })
  },
  createTask(data: { title: string; description?: string; assigned_to?: string; due_date?: string }) {
    return request<ProjectTask>("/projects/tasks", {
      method: "POST",
      body: JSON.stringify(data),
    })
  },
  updateTask(taskId: string, data: Partial<ProjectTask>) {
    return request<ProjectTask>(`/projects/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    })
  },
  deleteTask(taskId: string) {
    return request<{ status: string; message: string }>(`/projects/tasks/${taskId}`, {
      method: "DELETE",
    })
  },
  getVersionDualValidation(reportId: string, versionNumber: number) {
    return request<DualValidationVersionStatus>(`/evaluations/reports/${reportId}/version/${versionNumber}/dual-status`)
  },
  getAllVersionEvaluations(reportId: string, versionNumber: number) {
    return request<Evaluation[]>(`/evaluations/reports/${reportId}/version/${versionNumber}/all`)
  },
  adminAssignSupervisor(projectId: string, supervisorEmail: string, role = "ACADEMIC") {
    return request<{ status: string; message: string }>(`/admin/projects/${projectId}/assign-supervisor?supervisor_email=${encodeURIComponent(supervisorEmail)}&role=${encodeURIComponent(role)}`, {
      method: "POST",
    })
  },
  adminAssignBinome(projectId: string, studentEmail: string) {
    return request<{ status: string; message: string }>(`/admin/projects/${projectId}/assign-binome?student_email=${encodeURIComponent(studentEmail)}`, {
      method: "POST",
    })
  },
  saveEvaluation(
    reportId: string,
    versionNumber: number,
    grade: number,
    feedback?: string,
    approval_status?: ApprovalStatus,
    supervisor_role?: SupervisorRole,
    criteria_ratings?: Record<string, number>
  ) {
    return request<Evaluation>(`/evaluations/`, {
      method: "POST",
      body: JSON.stringify({
        report_id: reportId,
        version_number: versionNumber,
        grade,
        feedback,
        approval_status,
        supervisor_role,
        criteria_ratings,
      }),
    })
  },
  getEvaluationPdfUrl(reportId: string, versionNumber: number) {
    return `${API_BASE_URL}/evaluations/reports/${reportId}/version/${versionNumber}/pdf`
  },
  getAIAnalysis(reportId: string, versionNumber: number) {
    return request<AIAnalysisResponse>(`/ai/reports/${reportId}/version/${versionNumber}`)
  },
  getAdminStats() {
    return request<PlatformStats>("/admin/stats")
  },
  getAdminUsers(search = "", role = "") {
    const params = new URLSearchParams()
    if (search) params.append("search", search)
    if (role) params.append("role", role)
    const queryString = params.toString() ? `?${params.toString()}` : ""
    return request<AdminUserListResponse>(`/admin/users${queryString}`)
  },
  createAdminUser(payload: AdminUserCreatePayload) {
    return request<AdminUser>("/admin/users", {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },
  deleteAdminUser(userId: string) {
    return request<void>(`/admin/users/${userId}`, {
      method: "DELETE",
    })
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

  // ── Mock Defense Simulator API ────────────────────────────────
  getSubscriptionUsage() {
    return request<SubscriptionUsage>("/mock-defense/subscription/usage")
  },
  upgradeSubscription(plan: "FREE" | "PREMIUM") {
    return request<SubscriptionUsage>("/mock-defense/subscription/upgrade", {
      method: "POST",
      body: JSON.stringify({ plan }),
    })
  },
  createMockDefense(formData: FormData) {
    const token = getAccessToken()
    return fetch(`${API_BASE_URL}/mock-defense/`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Erreur lors de la création." }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      return res.json() as Promise<SimulationDetail>
    })
  },
  listMockDefenses() {
    return request<SimulationListItem[]>("/mock-defense/")
  },
  getMockDefense(id: string) {
    return request<SimulationDetail>(`/mock-defense/${id}`)
  },
  startMockDefenseSession(id: string) {
    return request<SimulationDetail>(`/mock-defense/${id}/start`, { method: "POST" })
  },
  submitMockDefenseAnswer(id: string, payload: {
    question_id: string
    answer: string
    answer_mode: string
    audio_duration_seconds?: number
  }) {
    return request<{
      question: MockDefenseQuestion
      evaluation: AnswerEvaluation
      has_follow_up: boolean
      follow_up_question?: MockDefenseQuestion | null
      is_finished: boolean
      current_question_index: number
      total_questions: number
    }>(`/mock-defense/${id}/answers`, {
      method: "POST",
      body: JSON.stringify(payload),
    })
  },
  getMockDefenseHint(id: string, question_id: string) {
    const fd = new FormData()
    fd.append("question_id", question_id)
    const token = getAccessToken()
    return fetch(`${API_BASE_URL}/mock-defense/${id}/hints`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: fd,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Erreur d'indice." }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      return res.json() as Promise<{ question_id: string; hint: string }>
    })
  },
  finishMockDefense(id: string) {
    return request<MockDefenseReport>(`/mock-defense/${id}/finish`, { method: "POST" })
  },
  getMockDefenseReport(id: string) {
    return request<MockDefenseReport>(`/mock-defense/${id}/report`)
  },
  deleteMockDefense(id: string) {
    return request<void>(`/mock-defense/${id}`, { method: "DELETE" })
  },
  transcribeMockDefenseAudio(formData: FormData) {
    const token = getAccessToken()
    return fetch(`${API_BASE_URL}/mock-defense/transcribe`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Erreur de transcription." }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      return res.json() as Promise<{
        transcription: string
        duration_seconds: number
        words_count: number
        words_per_minute: number
        filler_words_count: number
        filler_words_detected: string[]
        pacing_feedback: string
      }>
    })
  },

  // ── University Compliance Checker API ──────────────────────────
  getUniversityProfiles() {
    return request<UniversityProfile[]>("/compliance/universities")
  },
  parseCustomCharter(payload: { file?: File; guidelines_text?: string }) {
    const fd = new FormData()
    if (payload.file) fd.append("file", payload.file)
    if (payload.guidelines_text) fd.append("guidelines_text", payload.guidelines_text)
    const token = getAccessToken()
    return fetch(`${API_BASE_URL}/compliance/custom-charter`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: fd,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Erreur lors de l'analyse de la charte." }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      return res.json() as Promise<CustomCharterParseResult>
    })
  },
  checkCompliance(payload: {
    file?: File
    report_id?: string
    version_number?: number
    university_id: string
    custom_rules?: any
  }) {
    const fd = new FormData()
    if (payload.file) fd.append("file", payload.file)
    if (payload.report_id) fd.append("report_id", payload.report_id)
    if (payload.version_number !== undefined) fd.append("version_number", String(payload.version_number))
    fd.append("university_id", payload.university_id)
    if (payload.custom_rules) fd.append("custom_rules_json", JSON.stringify(payload.custom_rules))

    const token = getAccessToken()
    return fetch(`${API_BASE_URL}/compliance/check`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: fd,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Erreur lors du contrôle de conformité." }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      return res.json() as Promise<ComplianceReport>
    })
  },
  getLatestCompliance(report_id: string, version_number: number) {
    return request<ComplianceReport | null>(`/compliance/reports/${report_id}/version/${version_number}`)
  },
  runSmartFix(payload: {
    file?: File
    report_id?: string
    version_number?: number
    university_id: string
    custom_rules?: any
  }) {
    const fd = new FormData()
    if (payload.file) fd.append("file", payload.file)
    if (payload.report_id) fd.append("report_id", payload.report_id)
    if (payload.version_number !== undefined) fd.append("version_number", String(payload.version_number))
    fd.append("university_id", payload.university_id)
    if (payload.custom_rules) fd.append("custom_rules_json", JSON.stringify(payload.custom_rules))

    const token = getAccessToken()
    return fetch(`${API_BASE_URL}/compliance/smart-fix`, {
      method: "POST",
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: fd,
    }).then(async (res) => {
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: "Erreur lors du Smart Fix DOCX." }))
        throw new Error(err.detail || `HTTP ${res.status}`)
      }
      return res.json() as Promise<SmartFixResult>
    })
  },
  getFixedDocxDownloadUrl(downloadUrl: string) {
    if (downloadUrl.startsWith("http")) return downloadUrl
    return `${API_BASE_URL.replace("/api/v1", "")}${downloadUrl}`
  },

  // --- Meeting Logs & Progress Tracking ---
  getMeetingLogs(projectId: string, status?: MeetingLogStatus) {
    const q = status ? `?status=${encodeURIComponent(status)}` : ""
    return request<MeetingLog[]>(`/projects/${projectId}/meeting-logs${q}`)
  },
  getMeetingLog(projectId: string, logId: string) {
    return request<MeetingLog>(`/projects/${projectId}/meeting-logs/${logId}`)
  },
  createMeetingLog(projectId: string, data: MeetingLogCreateInput) {
    return request<MeetingLog>(`/projects/${projectId}/meeting-logs`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },
  updateMeetingLog(projectId: string, logId: string, data: MeetingLogUpdateInput) {
    return request<MeetingLog>(`/projects/${projectId}/meeting-logs/${logId}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
  },
  submitMeetingLog(projectId: string, logId: string) {
    return request<MeetingLog>(`/projects/${projectId}/meeting-logs/${logId}/submit`, {
      method: "POST",
    })
  },
  reviewMeetingLog(projectId: string, logId: string, data: MeetingLogReviewInput) {
    return request<MeetingLog>(`/projects/${projectId}/meeting-logs/${logId}/review`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },
  deleteMeetingLog(projectId: string, logId: string) {
    return request<void>(`/projects/${projectId}/meeting-logs/${logId}`, {
      method: "DELETE",
    })
  },

  // --- Final PFE Validation & Certificate ---
  validateFinalPFE(projectId: string, data: FinalValidationInput) {
    return request<CertificateResponse>(`/projects/${projectId}/final-validation`, {
      method: "POST",
      body: JSON.stringify(data),
    })
  },
  getProjectCertificate(projectId: string) {
    return request<CertificateResponse | null>(`/projects/${projectId}/certificate`)
  },
  async downloadCertificatePdf(certificateId: string, filename = `Certificat_PFE_${certificateId}.pdf`) {
    const blob = await requestBlob(`/certificates/${certificateId}/download`)
    triggerBlobDownload(blob, filename)
    return blob
  },
  verifyCertificate(identifier: string) {
    return request<PublicCertificateVerification>(`/certificates/verify/${encodeURIComponent(identifier)}`)
  },
}

export type JuryRole = "PRESIDENT" | "TECHNICAL" | "CRITICAL"
export type DefenseMode = "TRAINING" | "REALISTIC" | "STRESS_TEST"
export type DefenseDifficulty = "beginner" | "intermediate" | "expert"
export type DefenseLanguage = "fr" | "en" | "ar"

export interface SubscriptionUsage {
  plan: string
  monthly_simulations_limit: number
  monthly_simulations_used: number
  monthly_simulations_remaining: number
  max_questions_per_session: number
  voice_mode_enabled: boolean
  stress_test_mode_enabled: boolean
  detailed_revision_plan_enabled: boolean
  can_start_simulation: boolean
}

export interface VoiceMetrics {
  duration_seconds: number
  words_count: number
  words_per_minute: number
  filler_words_count: number
  filler_words_detected: string[]
  pacing_feedback: string
}

export interface CriteriaScores {
  technicalAccuracy: number
  depthOfUnderstanding: number
  reasoning: number
  clarity: number
  justification: number
  completeness: number
}

export interface AnswerEvaluation {
  overallScore: number
  criteria: CriteriaScores
  strengths: string[]
  weaknesses: string[]
  missingPoints: string[]
  technicalErrors: string[]
  improvedAnswer: string
  followUpQuestion?: string | null
  examinerFeedback?: string | null
  evaluated_at: string
}

export interface MockDefenseQuestion {
  id: string
  question_number: number
  examiner_role: JuryRole
  examiner_name: string
  examiner_title: string
  category: string
  difficulty: DefenseDifficulty
  text: string
  context_grounding?: string | null
  hint?: string | null
  is_follow_up?: boolean
  student_answer?: string | null
  answer_mode?: "text" | "voice"
  voice_metrics?: VoiceMetrics | null
  answered_at?: string | null
  evaluation?: AnswerEvaluation | null
}

export interface ProjectKnowledgeProfile {
  objectives: string[]
  problem_statement: string
  architecture_summary: string
  technologies: string[]
  database_choices: string[]
  key_methodologies: string[]
  technical_limitations: string[]
  security_considerations: string[]
  scalability_performance: string[]
  challengeable_claims: string[]
}

export interface MockDefenseReport {
  overall_score: number
  readiness_level: string
  criteria_averages: Record<string, number>
  jury_performance: Record<string, number>
  category_performance: Record<string, number>
  strongest_answers: {
    question_id: string
    question_number: number
    text: string
    score: number
    student_answer?: string
    strengths: string[]
  }[]
  weakest_answers: {
    question_id: string
    question_number: number
    text: string
    score: number
    student_answer?: string
    weaknesses: string[]
    missingPoints: string[]
  }[]
  repeated_mistakes: string[]
  knowledge_gaps: string[]
  technical_concepts_to_revise: string[]
  recommended_model_answers: {
    question: string
    model_answer: string
    examiner: string
  }[]
  personalized_revision_plan: {
    id: string
    priority: "critical" | "important" | "minor"
    title: string
    description: string
    estimated_gain: string
    estimated_time: string
  }[]
  suggested_next_questions: string[]
  disclaimer: string
  total_duration_seconds?: number | null
  completed_at: string
}

export interface SimulationListItem {
  id: string
  title: string
  academic_level: string
  category: string
  tech_stack: string[]
  language: DefenseLanguage
  difficulty: DefenseDifficulty
  mode: DefenseMode
  status: "PENDING" | "ANALYZING" | "READY" | "IN_PROGRESS" | "COMPLETED" | "FAILED"
  total_questions: number
  answered_questions: number
  overall_score?: number | null
  readiness_level?: string | null
  created_at: string
  updated_at: string
}

export interface SimulationDetail {
  id: string
  user_id: string
  project_id?: string | null
  title: string
  description: string
  academic_level: string
  category: string
  tech_stack: string[]
  language: DefenseLanguage
  difficulty: DefenseDifficulty
  mode: DefenseMode
  duration_minutes: number
  report_file_name?: string | null
  slides_file_name?: string | null
  status: "PENDING" | "ANALYZING" | "READY" | "IN_PROGRESS" | "COMPLETED" | "FAILED"
  knowledge_profile?: ProjectKnowledgeProfile | null
  questions: MockDefenseQuestion[]
  current_question_index: number
  final_report?: MockDefenseReport | null
  session_started_at?: string | null
  created_at: string
  updated_at: string
}

// ── Compliance Checker Interfaces ────────────────────────────────
export interface UniversityProfile {
  id: string
  name: string
  full_name: string
  description: string
  badge_color: string
  body_font_families: string[]
  body_font_size: number
  body_font_size_tolerance: number
  line_spacing: number
  margins_cm: {
    top: number
    bottom: number
    left: number
    right: number
  }
  alignment: string
  heading1_size: number
  heading2_size: number
  heading3_size: number
  figure_caption_pattern: string
  figure_caption_example: string
  table_caption_pattern: string
  table_caption_example: string
  page_numbering_preliminary: string
  page_numbering_body: string
  required_sections: string[]
}

export type ComplianceSeverity = "ERROR" | "WARNING" | "INFO"
export type ComplianceCategory =
  | "TYPOGRAPHY"
  | "MARGINS_SPACING"
  | "HEADINGS"
  | "FIGURES_TABLES"
  | "TOC_PAGINATION"
  | "STRUCTURE_SEMANTIC"

export interface ComplianceIssue {
  id: string
  category: ComplianceCategory
  severity: ComplianceSeverity
  title: string
  message: string
  pages: number[]
  suggestion: string
  expected?: string | null
  found?: string | null
  fixable_by_smart_fix: boolean
}

export interface ComplianceCategoryScore {
  score: number
  status: "PASS" | "WARNING" | "FAIL"
  total_checks: number
  passed_checks: number
  issues_count: number
}

export interface ComplianceReport {
  id: string
  report_id?: string | null
  version_number?: number | null
  file_name: string
  university_id: string
  university_name: string
  overall_score: number
  compliance_level: "CONFORME" | "CONFORME_AVEC_RESERVES" | "NON_CONFORME"
  summary: string
  category_scores: Record<ComplianceCategory, ComplianceCategoryScore>
  issues: ComplianceIssue[]
  stats: {
    page_count: number
    detected_figures: number
    detected_tables: number
    detected_headings: number
    toc_entries_count: number
    dominant_font: string
    dominant_font_size: number
    measured_line_spacing: number
    measured_margins_cm: { top: number; bottom: number; left: number; right: number }
    docx_fixable_issues_count: number
  }
  can_smart_fix_docx: boolean
  created_at: string
}

export interface CustomCharterParseResult {
  success: boolean
  extracted_profile: UniversityProfile
  raw_guidelines_summary: string
  detected_rules: string[]
}

export interface SmartFixResult {
  success: boolean
  message: string
  file_name: string
  download_url: string
  total_fixes_applied: number
  fixes_summary: string[]
}

export type MeetingLogStatus = "DRAFT" | "SUBMITTED" | "APPROVED" | "CHANGES_REQUESTED"

export interface MeetingLog {
  id: string
  project_id: string
  meeting_date: string
  work_completed: string
  encountered_blockers: string
  supervisor_feedback?: string
  next_week_objectives: string
  author_id: string
  author_name: string
  author_role: string
  status: MeetingLogStatus
  reviewed_by_id?: string | null
  reviewed_by_name?: string | null
  reviewed_by_role?: SupervisorRole | null
  reviewed_at?: string | null
  review_feedback?: string | null
  created_at: string
  updated_at: string
}

export interface MeetingLogCreateInput {
  meeting_date: string
  work_completed: string
  encountered_blockers: string
  supervisor_feedback?: string
  next_week_objectives: string
  status?: MeetingLogStatus
}

export interface MeetingLogUpdateInput {
  meeting_date?: string
  work_completed?: string
  encountered_blockers?: string
  supervisor_feedback?: string
  next_week_objectives?: string
  status?: MeetingLogStatus
}

export interface MeetingLogReviewInput {
  action: "APPROVE" | "REQUEST_CHANGES"
  feedback?: string
}

export type PFEValidationStatus = "PENDING" | "VALIDATED" | "REJECTED"

export interface FinalValidationInput {
  report_id?: string
  version_number?: number
  mention?: string
  notes?: string
  institution_name?: string
}

export interface CertificateResponse {
  id: string
  certificate_id: string
  verification_token: string
  project_id: string
  report_id: string
  version_number: number
  validation_status: PFEValidationStatus
  academic_year: string
  institution_name: string
  project_title: string
  student_names: string[]
  student_emails: string[]
  supervisor_name: string
  supervisor_email: string
  supervisor_role: SupervisorRole
  supervisor_mention?: string | null
  supervisor_notes?: string | null
  enterprise_supervisor_name?: string | null
  enterprise_supervisor_email?: string | null
  ai_compliance_score?: number | null
  ai_compliance_level?: string | null
  ai_compliance_summary?: string | null
  validation_date: string
  certificate_hash: string
  legal_notice: string
  download_count: number
  verification_url: string
  download_url: string
  created_at: string
}

export interface PublicCertificateVerification {
  is_valid: boolean
  status_label: string
  certificate_id: string
  validation_date?: string | null
  project_title: string
  institution_name: string
  academic_year: string
  student_names: string[]
  supervisor_name: string
  supervisor_role: string
  enterprise_supervisor_name?: string | null
  version_number: number
  ai_compliance_score?: number | null
  ai_compliance_level?: string | null
  legal_notice: string
  certificate_hash: string
}



