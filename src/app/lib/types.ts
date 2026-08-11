export interface Document {
    id: string;
    filename: string;
    file_size: number;
    doc_type?: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'needs_review';
    summary?: string;
    raw_text?: string;
    metadata?: any;
    created_at: string;
    processed_at?: string;
    uploaded_at?: string;
  }
  
  export interface UploadResponse {
    id: string;
    filename: string;
    status: string;
    message: string;
    text_extracted: boolean;
    summary_generated: boolean;
    classification?: string;
    confidence?: number;
    insights_count: number;
    anomalies_count: number;
    quality_issues_count: number;
    errors_count: number;
    needs_manual_review: boolean;
    embedding_stored: boolean;
  }
  
  export interface DashboardStats {
    total_documents: number;
    total_storage_bytes: number;
    total_storage_mb: number;
    success_rate: number;
    recent_uploads: Document[];
  }