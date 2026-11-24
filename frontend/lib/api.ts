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
): Promise<{ document_id: string; extraction: ExtractionStatus }[]> {
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
