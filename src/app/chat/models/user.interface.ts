export interface User {
  id: number;
  username: string;
  email: string;
  profile_image?: string | null;
  is_verified: boolean;
  created_at?: string;
}
