export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiEnvelope<T> {
  success: boolean;
  data: T;
  timestamp: string;
}

export interface LoginRequest { email: string; password: string; }
export interface LoginResponse { accessToken: string; user: User; }
export interface ChangePasswordRequest { currentPassword: string; newPassword: string; }

export type UserRole = 'ADMIN' | 'SUPER_ADMIN' | 'FINANCE_ADMIN' | 'SUPPORT' | 'CLIENT' | 'TRAINER';
export type UserStatus = 'ACTIVE' | 'INACTIVE' | 'SUSPENDED' | 'PENDING';

export interface User {
  id: string; firstName: string; lastName: string; email: string; phone?: string;
  role: UserRole; status: UserStatus; avatarUrl?: string; createdAt: string; updatedAt: string;
}

export type VerificationStatus = 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'APPROVED' | 'REJECTED' | 'EXPIRED';

export type TrainerTier = 'CERTIFIED' | 'EXPERIENCED' | 'ENTRY_LEVEL';
export type TrainerType = 'PROFESSIONAL' | 'VOCATIONAL' | 'BOTH';
export type CredentialType = 'DEGREE' | 'DIPLOMA' | 'CERTIFICATE' | 'LICENSE' | 'PROFESSIONAL_MEMBERSHIP' | 'TRADE_CERTIFICATE' | 'APPRENTICESHIP' | 'PORTFOLIO';

export interface Trainer {
  id: string; userId: string; user: User; bio?: string; hourlyRate: number; experience: number;
  location?: string; city?: string; county?: string; specialization?: string;
  latitude?: number; longitude?: number; verificationStatus: VerificationStatus;
  tier?: TrainerTier; trainerType?: TrainerType; categoryId?: string;
  averageRating: number; totalReviews: number; skills: Skill[]; certifications: Certification[];
  languages?: string[]; availableForOnline?: boolean; availableForPhysical?: boolean; availableForHybrid?: boolean;
  portfolioUrl?: string; linkedinUrl?: string; websiteUrl?: string;
  availabilitySlots?: AvailabilitySlot[]; recentReviews?: Review[];
  completedSessions?: number; currency?: string;
  createdAt: string; updatedAt: string;
}

export interface AvailabilitySlot {
  id: string; trainerId: string; dayOfWeek: number; startTime: string; endTime: string;
  isActive: boolean; consultantId?: string; departmentId?: string;
}

export interface Certification {
  id: string; name: string; issuer: string; issuedDate?: string; yearObtained?: number;
  expiryDate?: string; documentUrl?: string; verified?: boolean;
  credentialType?: CredentialType; verificationStatus?: string; rejectedReason?: string;
}

export type BookingStatus = 'PENDING_PAYMENT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'DISPUTED' | 'NO_SHOW';
export type SessionType = 'IN_PERSON' | 'VIRTUAL' | 'HYBRID';

export interface Booking {
  id: string; clientId: string; client: User; trainerId: string; trainer: Trainer;
  scheduledAt: string; duration: number; amount: number; status: BookingStatus;
  sessionType: SessionType; location?: string; notes?: string; escrowId?: string;
  createdAt: string; updatedAt: string;
}

export type TransactionType = 'CREDIT' | 'DEBIT' | 'HOLD' | 'RELEASE' | 'REFUND';

export interface Wallet {
  id: string; userId: string; user: User; balance: number; holdBalance: number;
  currency: string; createdAt: string; updatedAt: string;
}

export interface Transaction {
  id: string; walletId: string; userId: string; user?: User; type: TransactionType;
  amount: number; reference: string; description?: string; createdAt: string;
}

export type EscrowStatus = 'PENDING' | 'FUNDED' | 'RELEASED' | 'REFUNDED' | 'FROZEN' | 'DISPUTED';

export interface Escrow {
  id: string; bookingId: string; booking?: Booking; payerId: string; payer?: User;
  payeeId: string; payee?: User; amount: number; status: EscrowStatus;
  releasedAt?: string; refundedAt?: string; createdAt: string; updatedAt: string;
}

export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
export type PaymentProvider = 'MPESA' | 'STRIPE' | 'BANK_TRANSFER' | 'WALLET';

export interface Payment {
  id: string; userId: string; user?: User; amount: number; provider: PaymentProvider;
  status: PaymentStatus; reference: string; metadata?: Record<string, unknown>;
  bookingId?: string; createdAt: string; updatedAt: string;
}

export interface Review {
  id: string; bookingId: string; reviewerId: string; reviewer?: User; trainerId: string;
  trainer?: Trainer; rating: number; comment: string; isVisible: boolean;
  booking?: { id: string; sessionType?: string; scheduledAt?: string };
  createdAt: string; updatedAt: string;
}

export interface SubscriptionPlan {
  id: string; name: string; description: string; price: number; durationDays: number;
  currency: string; billingCycle: string; features: Record<string, unknown> | string[] | null;
  maxBookings: number | null; maxTeamMembers: number | null; commissionRate: number | null;
  trainerType: string | null; isActive: boolean; isGlobal: boolean; orgId: string | null;
  sortOrder: number; createdAt: string; updatedAt?: string;
}

export type SubscriptionStatus = 'ACTIVE' | 'CANCELLED' | 'EXPIRED' | 'PAUSED';

export interface Subscription {
  id: string; userId: string; user?: User; planId: string; plan?: SubscriptionPlan;
  status: SubscriptionStatus; startDate: string; endDate: string; autoRenew: boolean;
  createdAt: string; updatedAt: string;
}

export interface CommissionRule {
  id: string; name: string; minAmount: number; maxAmount: number; rate: number;
  commissionRate?: number; subscriptionTier?: string; trainerType?: string; orgId?: string;
  orgName?: string; isGlobal?: boolean; isActive: boolean; createdAt: string; updatedAt: string;
}

export interface CommissionRecord {
  id: string; bookingId: string; booking?: Booking; amount: number; rate: number;
  commissionRate?: number; commission: number; commissionAmount?: number;
  trainerPayout: number; trainerPayoutAmount?: number; bookingAmount?: number;
  trainerId?: string; trainerName?: string; trainerOrgName?: string;
  clientId?: string; clientName?: string;
  trainer?: { id: string; firstName: string; lastName: string; orgName?: string; trainerType?: string };
  client?: { id: string; firstName: string; lastName: string };
  createdAt: string;
}

export type DisputeStatus = 'OPEN' | 'UNDER_REVIEW' | 'RESOLVED' | 'RESOLVED_RELEASE' | 'RESOLVED_REFUND' | 'CLOSED';
export type DisputeResolution = 'RELEASE_TO_TRAINER' | 'REFUND_TO_CLIENT' | 'PARTIAL_REFUND' | 'NO_ACTION';

export interface Dispute {
  id: string; bookingId: string; booking?: Booking & {
    escrow?: { id: string; amount: number; status: string };
    trainer?: { id: string; firstName: string; lastName: string; trainerProfile?: { firmName?: string } };
    client?: { id: string; firstName: string; lastName: string };
    statusLogs?: { id: string; fromStatus?: string; toStatus: string; reason?: string; changedBy?: string; createdAt: string }[];
    sessionType?: string; scheduledAt?: string; duration?: number;
  };
  raisedById: string; raisedBy?: User;
  againstId: string; against?: User; status: DisputeStatus; category?: string; reason: string; description?: string;
  resolution?: string; resolvedById?: string; resolvedBy?: User; resolvedAt?: string;
  createdAt: string; updatedAt: string;
}

export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'IN_APP';
export type NotificationStatus = 'SENT' | 'DELIVERED' | 'FAILED' | 'PENDING';

export interface Notification {
  id: string; userId: string; user?: User; channel: NotificationChannel; title: string;
  message: string; status: NotificationStatus; sentAt: string; createdAt: string;
}

export type SkillLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED' | 'EXPERT';
export type SkillDemand = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface Skill {
  id: string; name: string; categoryId?: string; category?: string | Category;
  description?: string; icon?: string; level?: SkillLevel; trainerType?: TrainerType;
  isActive?: boolean; demand?: SkillDemand; tags?: string[];
  _count?: { trainers: number };
  createdAt: string; updatedAt: string;
}

export interface Category {
  id: string; name: string; description?: string; icon?: string; isActive: boolean;
  sortOrder: number; trainerType?: TrainerType; createdAt: string; updatedAt: string;
}

export interface VerificationRequest {
  id: string; trainerId: string; trainer?: Trainer; documentType: string; documentUrl: string;
  status: VerificationStatus; notes?: string; reviewNote?: string; reviewedBy?: string; reviewedAt?: string;
  createdAt: string; updatedAt: string;
}

export interface AuditLog {
  id: string; userId: string; user?: User; action: string; resource: string;
  resourceId?: string; ipAddress?: string; metadata?: Record<string, unknown>; createdAt: string;
}

export interface AnalyticsSummary {
  totalUsers: number; totalTrainers: number; activeBookings: number; revenue: number;
  previousPeriodRevenue: number; activeEscrows: number; pendingVerifications: number;
}

export interface ChartDataPoint { date: string; value: number; label?: string; }

export interface DashboardStats {
  totalUsers: number; totalTrainers: number; activeBookings: number; revenueMTD: number;
  activeEscrows: number; pendingVerifications: number; bookingsChart: ChartDataPoint[];
  revenueChart: ChartDataPoint[]; bookingsByStatus: { name: string; value: number }[];
  recentBookings: Booking[]; recentSignups: User[];
}

export interface PlatformSettings {
  appName: string; supportEmail: string; defaultCommissionRate: number;
  currency: string; maintenanceMode: boolean;
}
