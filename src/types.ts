export interface User {
  id: string;
  email: string;
  name?: string;
  isAdmin?: boolean;
  createdAt: string;
  username?: string;
  password?: string;
}

export interface WalkRoute {
  id: string;
  name: string;
  description?: string;
  color?: string;
  order: number;
}

export interface Category {
  id: string;
  name: string;
  description?: string;
}

export type MokebStatus = 'pending_stage1' | 'approved_stage1' | 'pending_stage2' | 'active' | 'rejected';

export interface Mokeb {
  id: string;
  trackingCode?: string;
  
  name: string;
  managerName: string;
  phone: string;
  emergencyPhone?: string;
  nationalId?: string;
  fatherName?: string;
  categoryId: string;
  description?: string;
  documentUrl?: string;
  showContactInfoPublicly?: boolean;
  
  lat?: number;
  lng?: number;
  address?: string;
  routeId?: string;
  amoodNumber?: number;
  exactServices?: string;
  responsiblePersons?: string;

  // New professional/creative fields
  avatarUrl?: string;
  detailedDescription?: string;
  staffList?: string[];
  selectedServices?: string[];
  galleryUrls?: string[];

  ownerId: string;
  status: MokebStatus;
  proCardRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  storyRequestStatus?: 'none' | 'pending' | 'approved' | 'rejected';
  stories?: MokebStory[];
  announcements?: MokebAnnouncement[];
  createdAt: any;
  updatedAt?: any;
}

export interface MokebStory {
  id: string;
  mediaUrl?: string; // Optional for text-only
  mediaType?: 'image' | 'video'; // Optional for text-only
  caption: string; // The main content or caption
  createdAt: any;
  expiresAt: any;
  views?: number; // Added
}

export interface MokebAnnouncement {
  id: string;
  title: string;
  content: string;
  createdAt: any;
  active: boolean;
}

export interface MokebReview {
  id: string;
  mokebId: string;
  userId: string;
  userName: string;
  rating: number; // 1-5
  comment: string;
  createdAt: any;
}

export interface AppSlider {
  id: string;
  imageUrl: string;
  title?: string;
  subtitle?: string;
  link?: string;
  buttonText?: string;
  order: number;
  active: boolean;
  createdAt?: any;
}

export interface SiteSettings {
  id: string;
  siteLogoUrl?: string;
  siteName?: string;
  sqlHost?: string;
  sqlUser?: string;
  sqlPassword?: string;
  sqlDatabase?: string;
  footerText?: string;
  pwaRegistrationBannerEnabled?: boolean;
  pwaVisitorAnnouncement?: string;
  updatedAt?: any;
}

export type TicketStatus = 'open' | 'in_progress' | 'answered' | 'closed';
export type TicketPriority = 'low' | 'medium' | 'high' | 'critical';

export interface Ticket {
  id: string;
  userId: string;
  userDisplayName?: string;
  userEmail?: string;
  mokebName?: string;
  subject: string;
  category: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt: any;
  updatedAt: any;
  lastMessageText?: string;
  lastSenderRole?: 'user' | 'admin';
  unreadByAdmin?: boolean;
  unreadByUser?: boolean;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  senderName: string;
  senderRole: 'user' | 'admin';
  text: string;
  createdAt: any;
}

