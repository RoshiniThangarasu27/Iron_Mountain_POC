export const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000").replace(/\/+$/, "");
export const MAX_UPLOAD_MB = Number(process.env.NEXT_PUBLIC_MAX_UPLOAD_MB || 25);

export type DocType = "edi_837" | "eob_835";

export type ExtractionState = "not_started" | "queued" | "running" | "retrying" | "succeeded" | "failed";

export const TERMINAL_EXTRACTION_STATES: ExtractionState[] = ["not_started", "succeeded", "failed"];

export interface ExtractionStatus {
  task_id: string | null;
  state: ExtractionState;
  celery_state: string | null;
  step: string | null;
  error: string | null;
  retries: number | null;
  requested_at: string | null;
  finished_at: string | null;
}

export interface ExtractedClaim {
  claim_id?: string;
  claim_amount?: string;
  patient_name?: string;
  patient_first_name?: string;
  patient_last_name?: string;
  member_id?: string;
  provider_name?: string;
  provider_npi?: string;
  date_of_service?: string;
  date_of_service_from?: string;
  date_of_service_to?: string;
  service_lines?: { procedure_code?: string; line_charge_amount?: string; units?: string }[];
}

export interface EobClaim {
  claim_id?: string | null;
  patient_id?: string | null;
  patient_name?: string | null;
  provider_name?: string | null;
  provider_npi?: string | null;
  date_of_service_from?: string | null;
  date_of_service_to?: string | null;
  service_code?: string | null;
  modifier?: string | null;
  units?: number | null;
  billed_amount?: number | null;
  allowed_amount?: number | null;
  paid_amount?: number | null;
  patient_responsibility?: number | null;
  confidence?: Record<string, number | null>;
}

export interface EobPayload {
  payment_info?: { payment_date?: string | null; payment_reference?: string | null };
  claims?: EobClaim[];
  remark_codes?: { code?: string | null; description?: string | null }[];
  document_confidence?: number | null;
  requires_human_review?: boolean;
}

export interface ExtractionResult {
  document_id: string;
  doc_type: DocType;
  extractor: "claim_extractor" | "eob_extractor";
  duration_ms: number;
  claim?: ExtractedClaim;
  payload?: EobPayload;
  review?: { required: boolean; reason: string | null };
  validation_errors?: Record<string, string[]>;
  model?: string;
}

export interface ExtractionDetail extends ExtractionStatus {
  result: ExtractionResult | null;
}

export interface MatchingSummary {
  claims: number;
  auto_matched: number;
  needs_review: number;
  unmatched: number;
  confirmed: number;
  no_match: number;
  skipped: boolean;
  skip_reason: string | null;
  stale: boolean;
}

export interface MatchingStatus extends ExtractionStatus {
  summary: MatchingSummary | null;
}

export type EffectiveMatchStatus = "auto_matched" | "needs_review" | "unmatched" | "confirmed" | "no_match";

export const MATCH_WEIGHTS = {
  patient_name: 20,
  date_of_service: 15,
  service_code: 10,
  billed_amount: 10,
  provider_name: 5,
} as const;

export const AUTO_MATCH_THRESHOLD = 85;
export const REVIEW_THRESHOLD = 60;

export interface MatchInput {
  patient_id: string | null;
  claim_id: string | null;
  patient_name: string | null;
  date_of_service_from: string | null;
  date_of_service_to: string | null;
  service_code: string | null;
  billed_amount: number | string | null;
  paid_amount: number | string | null;
  provider_name: string | null;
}

export interface CandidateClaim {
  claim_id: string | null;
  member_id: string | null;
  patient_name: string | null;
  date_of_service_from: string | null;
  date_of_service_to: string | null;
  claim_amount: string | null;
  provider_name: string | null;
  provider_npi: string | null;
  service_lines: { procedure_code?: string; line_charge_amount?: string; units?: string }[];
}

export interface MatchCandidate {
  document_id: string | null;
  filename: string | null;
  claim_id: string | null;
  score: number;
  status: "AUTO_MATCH" | "REVIEW" | "NO_MATCH";
  matched_on: string[];
  score_breakdown: Partial<Record<keyof typeof MATCH_WEIGHTS, number>>;
  identifier_matches: string[];
  identifier_conflicts: { field: string; label: string; eob: string | null; claim: string | null }[];
  claim: CandidateClaim;
}

export interface ClaimReview {
  claim_index: number;
  decision: "accepted" | "no_match";
  edi_document_id: string | null;
  edi_claim_id: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClaimMatchItem {
  index: number;
  input: MatchInput;
  best_match: MatchCandidate | null;
  candidates: MatchCandidate[];
  hitl: { requires_human_review?: boolean; match_score?: number; reasons?: string[] };
  effective_status: EffectiveMatchStatus;
  review: ClaimReview | null;
}

export interface MatchingDetail extends MatchingStatus {
  matched_at: string | null;
  repository_size: number | null;
  forced: boolean;
  claims: ClaimMatchItem[];
}

export interface LinkedClaim {
  document_id: string | null;
  filename: string | null;
  claim_id: string | null;
  score: number | null;
}

export interface ReconciliationRow {
  eob_document_id: string;
  eob_filename: string;
  claim_index: number;
  eob_claim: MatchInput;
  status: EffectiveMatchStatus;
  match_score: number | null;
  reasons: string[];
  linked: LinkedClaim | null;
  suggested: LinkedClaim | null;
  review: ClaimReview | null;
  matched_at: string | null;
  stale: boolean;
}

export interface ReconciliationResponse {
  summary: Record<EffectiveMatchStatus, number>;
  documents: { total: number; matched: number; in_progress: number; skipped: number; failed: number; not_started: number };
  rows: ReconciliationRow[];
}

export interface DocumentRecord {
  id: string;
  doc_type: DocType;
  original_filename: string;
  stored_filename: string;
  storage_path: string;
  mime_type: string;
  file_size_bytes: number;
  sha256_hash: string;
  created_at: string;
  extraction: ExtractionStatus | null;
  matching: MatchingStatus | null;
}

export interface DocumentList {
  items: DocumentRecord[];
  total: number;
  limit: number;
  offset: number;
}

export interface UploadResponse {
  doc_type: DocType;
  documents: DocumentRecord[];
  errors: { filename: string; error: string }[];
  warnings: { filename: string; document_id: string; message: string; duplicate_of: string[] }[];
}

export class ApiError extends Error {
  constructor(message: string, public status?: number) {
    super(message);
    this.name = "ApiError";
  }
}

function extractDetail(body: unknown, fallback: string): string {
  if (body && typeof body === "object" && "detail" in body) {
    const detail = (body as { detail: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail)) {
      return detail
        .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : String(d)))
        .join("; ");
    }
  }
  return fallback;
}

const networkError = () =>
  new ApiError(`Could not reach the API at ${API_BASE_URL}. Is the backend running?`);

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_BASE_URL}${path}`, { cache: "no-store", ...init });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw networkError();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(extractDetail(body, `Request failed (${res.status})`), res.status);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

export function listDocuments(docType: DocType, signal?: AbortSignal): Promise<DocumentList> {
  return request<DocumentList>(`/api/documents?doc_type=${docType}&limit=500`, { signal });
}

export function deleteDocument(id: string): Promise<void> {
  return request<void>(`/api/documents/${id}`, { method: "DELETE" });
}

export interface BulkDeleteResponse {
  deleted: string[];
  not_found: string[];
  file_cleanup_failed: string[];
}

export function bulkDeleteDocuments(ids: string[], docType?: DocType): Promise<BulkDeleteResponse> {
  return request<BulkDeleteResponse>(`/api/documents/bulk-delete`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, doc_type: docType ?? null }),
  });
}

export function getExtractionStatuses(
  ids: string[],
  signal?: AbortSignal,
): Promise<{ document_id: string; extraction: ExtractionStatus; matching: MatchingStatus | null }[]> {
  return request(`/api/documents/extraction-status`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
    signal,
  });
}

export function getExtraction(id: string, signal?: AbortSignal): Promise<ExtractionDetail> {
  return request<ExtractionDetail>(`/api/documents/${id}/extraction`, { signal });
}

export function startExtraction(id: string): Promise<ExtractionDetail> {
  return request<ExtractionDetail>(`/api/documents/${id}/extract`, { method: "POST" });
}

export function isExtractionActive(status: ExtractionStatus | null | undefined): boolean {
  return !!status && !TERMINAL_EXTRACTION_STATES.includes(status.state);
}

export function getMatching(id: string, signal?: AbortSignal): Promise<MatchingDetail> {
  return request<MatchingDetail>(`/api/documents/${id}/matches`, { signal });
}

export function startMatching(id: string, force = false): Promise<MatchingDetail> {
  return request<MatchingDetail>(`/api/documents/${id}/match`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ force }),
  });
}

export function saveReview(
  id: string,
  claimIndex: number,
  body: { decision: "accepted" | "no_match"; edi_document_id?: string | null; note?: string | null },
): Promise<ClaimReview> {
  return request<ClaimReview>(`/api/documents/${id}/matches/${claimIndex}/review`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

export function deleteReview(id: string, claimIndex: number): Promise<void> {
  return request<void>(`/api/documents/${id}/matches/${claimIndex}/review`, { method: "DELETE" });
}

export function getReconciliation(
  params: { status?: EffectiveMatchStatus; edi_document_id?: string } = {},
  signal?: AbortSignal,
): Promise<ReconciliationResponse> {
  const query = new URLSearchParams();
  if (params.status) query.set("status", params.status);
  if (params.edi_document_id) query.set("edi_document_id", params.edi_document_id);
  const qs = query.toString();
  return request<ReconciliationResponse>(`/api/reconciliation${qs ? `?${qs}` : ""}`, { signal });
}

export function rerunAllMatching(): Promise<{ queued: number; skipped: number }> {
  return request(`/api/reconciliation/rerun`, { method: "POST" });
}

export function contentUrl(id: string, download = false): string {
  return `${API_BASE_URL}/api/documents/${id}/content${download ? "?download=true" : ""}`;
}

export async function fetchDocumentText(id: string, signal?: AbortSignal): Promise<string> {
  let res: Response;
  try {
    res = await fetch(contentUrl(id), { cache: "no-store", signal });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw networkError();
  }
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new ApiError(extractDetail(body, `Could not load file (${res.status})`), res.status);
  }
  return res.text();
}

export function uploadDocuments(
  docType: DocType,
  files: File[],
  onProgress?: (percent: number) => void,
): { promise: Promise<UploadResponse>; abort: () => void } {
  const xhr = new XMLHttpRequest();
  const promise = new Promise<UploadResponse>((resolve, reject) => {
    const form = new FormData();
    form.append("doc_type", docType);
    files.forEach((f) => form.append("files", f, f.name));

    xhr.open("POST", `${API_BASE_URL}/api/documents/upload`);
    xhr.responseType = "json";
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      const body = xhr.response as unknown;
      const isUploadResponse =
        !!body && typeof body === "object" && "documents" in body && "errors" in body;
      if ((xhr.status === 201 || xhr.status === 400) && isUploadResponse) {
        resolve(body as UploadResponse);
      } else {
        reject(new ApiError(extractDetail(body, `Upload failed (${xhr.status})`), xhr.status));
      }
    };
    xhr.onerror = () => reject(networkError());
    xhr.onabort = () => reject(new ApiError("Upload cancelled"));
    xhr.send(form);
  });
  return { promise, abort: () => xhr.abort() };
}
