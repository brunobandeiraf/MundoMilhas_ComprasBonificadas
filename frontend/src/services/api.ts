const BASE_URL = '/api'

interface ApiError {
  error: string
  details?: Record<string, unknown>
}

class SessionExpiredError extends Error {
  constructor() {
    super('Sessão expirada')
    this.name = 'SessionExpiredError'
  }
}

async function fetchWithAuth(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = localStorage.getItem('token')

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  }

  if (token) {
    ;(headers as Record<string, string>)['Authorization'] = `Bearer ${token}`
  }

  const response = await fetch(`${BASE_URL}${endpoint}`, {
    ...options,
    headers,
  })

  if (response.status === 401) {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    window.location.href = '/login'
    throw new SessionExpiredError()
  }

  return response
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData: ApiError = await response.json().catch(() => ({
      error: 'Erro inesperado',
    }))
    throw new ApiResponseError(response.status, errorData.error, errorData.details)
  }
  return response.json()
}

export class ApiResponseError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message)
    this.name = 'ApiResponseError'
  }
}

// --- Auth endpoints ---

export interface LoginResponse {
  token: string
  user: { id: string; email: string; name: string; role: string }
}

export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  })
  return handleResponse<LoginResponse>(response)
}

export async function initiateActivation(email: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/auth/activate/initiate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  await handleResponse(response)
}

export interface ConfirmActivationParams {
  email: string
  token: string
  password: string
  name?: string
  phone?: string
}

export async function confirmActivation(
  params: ConfirmActivationParams
): Promise<LoginResponse> {
  const response = await fetch(`${BASE_URL}/auth/activate/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  return handleResponse<LoginResponse>(response)
}

export async function resendToken(email: string): Promise<void> {
  const response = await fetch(`${BASE_URL}/auth/activate/resend`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  await handleResponse(response)
}

export async function logout(): Promise<void> {
  const response = await fetchWithAuth('/auth/logout', { method: 'POST' })
  await handleResponse(response)
}

// --- Stores endpoints ---

export interface StoreScore {
  programName: string
  score: number
}

export interface StoreItem {
  id: string
  name: string
  imageUrl: string | null
  category: string | null
  bestScore: number
  programName: string
  scores: StoreScore[]
}

export interface PaginationInfo {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface StoresResponse {
  data: StoreItem[]
  pagination: PaginationInfo
}

export interface StoreFilters {
  page?: number
  limit?: number
  search?: string
  category?: string
  program?: string
  sortBy?: string
  minScore?: number
  maxScore?: number
}

export async function getStores(filters: StoreFilters = {}): Promise<StoresResponse> {
  const params = new URLSearchParams()
  if (filters.page) params.set('page', String(filters.page))
  if (filters.limit) params.set('limit', String(filters.limit))
  if (filters.search) params.set('search', filters.search)
  if (filters.category) params.set('category', filters.category)
  if (filters.program) params.set('program', filters.program)
  if (filters.sortBy) params.set('sortBy', filters.sortBy)
  if (filters.minScore) params.set('minScore', String(filters.minScore))
  if (filters.maxScore) params.set('maxScore', String(filters.maxScore))

  const query = params.toString()
  const endpoint = `/stores${query ? `?${query}` : ''}`
  const response = await fetchWithAuth(endpoint)
  return handleResponse<StoresResponse>(response)
}

export async function getCategories(): Promise<string[]> {
  const response = await fetchWithAuth('/stores/categories')
  return handleResponse<string[]>(response)
}

export interface StoreHistoryItem {
  date: string
  score: number
  programName: string
}

export interface StoreDetails {
  id: string
  name: string
  imageUrl: string | null
  category: string | null
  description: string | null
  link: string | null
  scores: Array<{
    programName: string
    score: number
    description: string | null
    rule: string | null
    deadline: string | null
    link: string | null
  }>
  history: StoreHistoryItem[]
}

export async function getStoreDetails(storeId: string): Promise<StoreDetails> {
  const response = await fetchWithAuth(`/stores/${storeId}`)
  return handleResponse<StoreDetails>(response)
}

// --- Admin endpoints ---

export interface CreateUserParams {
  email: string
  name?: string
  phone?: string
  sendActivationNow: boolean
}

export interface CreateUserResponse {
  user: { id: string; email: string; name: string; activationStatus: 'sent' | 'pending' }
}

export async function createUser(params: CreateUserParams): Promise<CreateUserResponse> {
  const response = await fetchWithAuth('/admin/users', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return handleResponse<CreateUserResponse>(response)
}

export interface UserItem {
  id: string
  email: string
  name: string | null
  phone: string | null
  role: string
  isActive: boolean
  createdAt: string
}

export interface UsersResponse {
  data: UserItem[]
  pagination: PaginationInfo
}

export async function getUsers(page = 1, limit = 50): Promise<UsersResponse> {
  const response = await fetchWithAuth(`/admin/users?page=${page}&limit=${limit}`)
  return handleResponse<UsersResponse>(response)
}

export async function toggleUserStatus(userId: string): Promise<UserItem> {
  const response = await fetchWithAuth(`/admin/users/${userId}/toggle-status`, { method: 'PATCH' })
  return handleResponse<UserItem>(response)
}

export async function deleteUser(userId: string): Promise<void> {
  const response = await fetchWithAuth(`/admin/users/${userId}`, { method: 'DELETE' })
  await handleResponse(response)
}

export interface ProgramItem {
  id: string
  name: string
  url: string
  isActive: boolean
  createdAt: string
}

export async function getPrograms(): Promise<ProgramItem[]> {
  const response = await fetchWithAuth('/admin/programs')
  return handleResponse<ProgramItem[]>(response)
}

export interface CreateProgramParams {
  name: string
  url: string
}

export async function createProgram(params: CreateProgramParams): Promise<ProgramItem> {
  const response = await fetchWithAuth('/admin/programs', {
    method: 'POST',
    body: JSON.stringify(params),
  })
  return handleResponse<ProgramItem>(response)
}

export async function updateProgram(programId: string, data: { url?: string; isActive?: boolean }): Promise<ProgramItem> {
  const response = await fetchWithAuth(`/admin/programs/${programId}`, {
    method: 'PATCH',
    body: JSON.stringify(data),
  })
  return handleResponse<ProgramItem>(response)
}

export interface CrawlerRunResponse {
  results: Array<{
    programName: string
    status: string
    storesFound: number
    errorMessage?: string
  }>
}

export async function runCrawler(): Promise<CrawlerRunResponse> {
  const response = await fetchWithAuth('/admin/crawler/run', { method: 'POST' })
  return handleResponse<CrawlerRunResponse>(response)
}

export async function runCrawlerForProgram(programId: string): Promise<CrawlerRunResponse> {
  const response = await fetchWithAuth(`/admin/crawler/run/${programId}`, { method: 'POST' })
  return handleResponse<CrawlerRunResponse>(response)
}

export async function getCrawlerSchedule(): Promise<{ schedule: string }> {
  const response = await fetchWithAuth('/admin/crawler/schedule')
  return handleResponse<{ schedule: string }>(response)
}

export async function getCrawlerStatus(): Promise<{ running: string[] }> {
  const response = await fetchWithAuth('/admin/crawler/status')
  return handleResponse<{ running: string[] }>(response)
}

export async function updateCrawlerSchedule(schedule: string): Promise<void> {
  const response = await fetchWithAuth('/admin/crawler/schedule', {
    method: 'PUT',
    body: JSON.stringify({ schedule }),
  })
  await handleResponse(response)
}

export interface CrawlLogItem {
  id: string
  programId: string
  programName: string
  status: string
  storesFound: number
  errorMessage: string | null
  startedAt: string
  completedAt: string
}

export async function getCrawlerHistory(): Promise<CrawlLogItem[]> {
  const response = await fetchWithAuth('/admin/crawler/history')
  return handleResponse<CrawlLogItem[]>(response)
}

// Store management
export interface AdminStoreItem {
  id: string
  name: string
  category: string | null
  imageUrl: string | null
  programs: string[]
}

export async function getAdminStores(): Promise<AdminStoreItem[]> {
  const response = await fetchWithAuth('/admin/stores')
  return handleResponse<AdminStoreItem[]>(response)
}

export async function updateStoreCategory(storeId: string, category: string): Promise<void> {
  const response = await fetchWithAuth(`/admin/stores/${storeId}/category`, {
    method: 'PATCH',
    body: JSON.stringify({ category }),
  })
  await handleResponse(response)
}

export async function mergeStores(primaryStoreId: string, aliasStoreId: string): Promise<{ message: string }> {
  const response = await fetchWithAuth('/admin/stores/merge', {
    method: 'POST',
    body: JSON.stringify({ primaryStoreId, aliasStoreId }),
  })
  return handleResponse<{ message: string }>(response)
}

export interface StoreAliasItem {
  id: string
  primaryStore: { id: string; name: string }
  aliasStore: { id: string; name: string }
}

export async function getStoreAliases(): Promise<StoreAliasItem[]> {
  const response = await fetchWithAuth('/admin/stores/aliases')
  return handleResponse<StoreAliasItem[]>(response)
}

export async function removeStoreAlias(aliasId: string): Promise<void> {
  const response = await fetchWithAuth(`/admin/stores/aliases/${aliasId}`, { method: 'DELETE' })
  await handleResponse(response)
}
