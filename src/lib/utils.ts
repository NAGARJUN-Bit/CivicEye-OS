import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp: Date;
  isCompleted: boolean;
}

export interface Issue {
  id: string;
  issueType: string;
  image: string;
  location: {
    latitude: number;
    longitude: number;
  };
  confidence: number;
  severity: string;
  department: string;
  estimatedResolution: string;
  trustScore: number;
  verificationCount: number;
  status:
    | 'submitted'
    | 'classified'
    | 'verification'
    | 'assigned'
    | 'in_progress'
    | 'pending_authority'
    | 'accepted'
    | 'repair_scheduled'
    | 'resolved';
  timeline: TimelineEvent[];
  createdAt: Date;
  // Raw AI response fields
  grievanceDocument: string;
  accidentRisk: string;
  // Optional fields
  complaintId?: string;
  officialComplaintText?: string;
  // Media metadata
  mediaType?: 'image' | 'video';
  videoDurationSeconds?: number;
  framesAnalyzed?: number;
}
