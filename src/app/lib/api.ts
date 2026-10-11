const API_BASE_URL = 'http://localhost:8000';

export function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const token = localStorage.getItem('udv_access_token') || '';
  const headers = new Headers(init.headers || {});
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (!headers.has('Content-Type') && !(init.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json');
  }
  return fetch(input, { ...init, headers });
}

export interface SuggestedQuestionsResponse {
  document_id: string;
  document_name: string;
  document_type: string;
  has_analysis: boolean;
  suggested_questions: string[];
}

export interface DocumentResponse {
  id: string;
  filename: string;
  file_size: number;
  doc_type: string;
  status: string;
  summary?: string;
  metadata?: DocumentMetadata;
  created_at: string;
  processed_at?: string;
  insights?: Insight[];
  key_points?: string[];
  classification?: {
    type: string;
    confidence: number;
    reasoning: string;
  };
}

export interface DocumentMetadata {
  keywords?: string[];
  metrics?: {
    word_count: number;
    char_count: number;
    estimated_read_time: string;
    tables_found: number;
    document_type: string;
    classification_confidence: number;
  };
  anomalies?: Anomaly[];
  quality_issues?: string[];
  tables?: Array<{           // ADD THIS
    columns: string[];
    rows: number;
    data: any[][];
  }>;
  analytics?: any;           // ADD THIS (for micro-dashboard)
}

export interface Insight {
  title: string;
  description: string;
  category: string;
}

export interface Anomaly {
  type: string;
  severity: string;
  message: string;
}

export interface SearchResult {
  id: string;
  filename: string;
  doc_type: string;
  summary: string | null;
  similarity: number;
  similarity_percent?: string;
  match_quality: string;
  match_type?: string;  // ✅ Add this - 'keyword' or 'semantic'
  key_points?: string[];
  created_at: string | null;
}
    
export interface SemanticSearchResponse {
  query: string;
  results: SearchResult[];
  count: number;
}

export interface SimilarDocumentsResponse {
  source_document: {
    id: string;
    filename: string;
    doc_type: string;
  };
  similar_documents: SearchResult[];
  count: number;
}

export class ApiService {
  private baseUrl = API_BASE_URL;

async uploadDocument(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await authFetch(`${this.baseUrl}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Upload failed');
    }

    return response.json();
  }

  async getDocuments(skip = 0, limit = 100): Promise<{ documents: DocumentResponse[]; total: number }> {
    const response = await authFetch(`${this.baseUrl}/api/documents?skip=${skip}&limit=${limit}`);
    
    if (!response.ok) {
      throw new Error('Failed to fetch documents');
    }

    const data = await response.json();
    console.log('Documents from API:', data); // ✅ Add logging
    
    return data;
  }

  async getDocument(id: string): Promise<DocumentResponse> {
    const response = await authFetch(`${this.baseUrl}/api/documents/${id}`);
    if (!response.ok) throw new Error('Failed to fetch document');
    return response.json();
  }

  async deleteDocument(id: string): Promise<void> {
    const response = await authFetch(`${this.baseUrl}/api/documents/${id}`, { method: 'DELETE' });
    if (!response.ok) throw new Error('Failed to delete document');
  }

  async semanticSearch(query: string, limit = 10): Promise<SemanticSearchResponse> {
    const response = await authFetch(
      `${this.baseUrl}/api/search/semantic?query=${encodeURIComponent(query)}&limit=${limit}`,
      { method: 'POST' }
    );
    if (!response.ok) throw new Error('Semantic search failed');
    return response.json();
  }

  async getSimilarDocuments(docId: string, limit: number = 5): Promise<any> {
    const response = await authFetch(`${this.baseUrl}/api/search/documents/${docId}/similar?limit=${limit}`);
    if (!response.ok) throw new Error('Failed to fetch similar documents');
    return response.json();
  }

  async getHealth(): Promise<any> {
    const response = await fetch(`${this.baseUrl}/health`); // health is public
    if (!response.ok) throw new Error('Health check failed');
    return response.json();
  }

  async getDashboardAnalytics(): Promise<any> {
    const response = await authFetch(`${this.baseUrl}/api/analytics/dashboard`);
    if (!response.ok) throw new Error('Failed to fetch analytics');
    return response.json();
  }

  async askDocumentQuestion(
    docId: string,
    question: string,
    conversationHistory: Array<{question: string, answer: string}> = []
  ): Promise<any> {
    const response = await authFetch(
      `${this.baseUrl}/api/search/documents/${docId}/ask`,
      {
        method: 'POST',
        body: JSON.stringify({ question, conversation_history: conversationHistory }),
      }
    );
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.detail || 'Failed to get answer');
    }
    return response.json();
  }

  async getDocumentStatus(docId: string): Promise<any> {
    const response = await authFetch(`${this.baseUrl}/api/documents/${docId}/status`);
    if (!response.ok) throw new Error('Failed to fetch document status');
    return response.json();
  }

  async getSuggestedQuestions(documentId: string): Promise<SuggestedQuestionsResponse> {
    const response = await authFetch(`${API_BASE_URL}/api/search/documents/${documentId}/suggested-questions`);
  
    if (!response.ok) throw new Error(`Failed to get suggested questions: ${response.statusText}`);
    return response.json();
  }
}

// Export singleton instance
export const api = new ApiService();