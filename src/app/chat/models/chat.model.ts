export interface Chat {
  messages: any;
  id: string;
  twin_details?: {
    id: string;
    twin_name: string;
    avatar_url: any;
  };
  created_at: string;
  last_active: string;
  user_has_access: boolean;
  twin_is_active: boolean;
  last_message?: {
    id: string;
    text_content: string;
    message_type: string;
    created_at: string;
    is_from_user: boolean;
    is_delivered: boolean;
    is_read: boolean;
  };
  unread_count: number;
}
