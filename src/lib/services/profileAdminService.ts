import api from '../api';

export interface WorkExperience {
  id: string;
  company: string;
  title: string;
  startDate?: string;
  endDate?: string;
  current?: boolean;
  description?: string;
}

export interface Education {
  id: string;
  institution: string;
  degree?: string;
  field?: string;
  startYear?: number;
  endYear?: number;
}

export interface JobSeekerProfile {
  id: string;
  userId: string;
  headline?: string;
  bio?: string;
  location?: string;
  openToWork?: boolean;
  skills?: string[];
  workExperiences?: WorkExperience[];
  educations?: Education[];
  resumeUrl?: string;
  linkedinUrl?: string;
  portfolioUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export const profileAdminService = {
  get: (userId: string): Promise<JobSeekerProfile | null> =>
    api.get(`/profile/${userId}`)
      .then(r => (r.data as any)?.data ?? null)
      .catch(() => null),
};
