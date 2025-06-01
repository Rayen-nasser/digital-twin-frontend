export interface Message {
user: any;
content: any;
image_url?: any;
is_translated: any;
reactions: any;
reply_details?: any,
reply_to?: any;
  timestamp: string;
  is_read: boolean;
  is_delivered: boolean;
  id: string;
  chat: string;
  is_from_user: boolean;
  message_type: 'text' | 'voice' | 'file';
  text_content?: string;
  voice_note?: string;
  voice_note_details?: {
    id: string;
    duration_seconds: number;
    format: string;
    sample_rate: number;
    created_at: string;
    is_processed: boolean;
    transcription?: string;
    storage_path?: string;
    file_url?: string;
  };
  file_attachment?: any;
  file_details?: {
    id: string;
    original_name: string;
    file_category: string;
    mime_type: string;
    size_bytes: number;
    uploaded_at: string;
    is_public: boolean;
    thumbnail_path?: string;
    dimensions?: string;
    file_url?: string;
  };
  created_at: string;
  status: 'sent' | 'delivered' | 'read' | 'sending'| 'error';
  status_updated_at: string;
  duration_seconds?: number;
  file_preview_url?: string;
  twin_id?: string;
}
