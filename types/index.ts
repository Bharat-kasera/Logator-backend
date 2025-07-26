import { Request } from "express";

export interface User {
  id: number;
  phone: string;
  email?: string;
  firstname?: string;
  lastname?: string;
  country_code?: string;
  photo_url?: string;
  plan?: number;
  representing?: string;
  createdby?: number;
  created_at: Date;
  updated_at?: Date;
}

// Extend Express Request to include user info
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        phone: string;
        plan: number;
        country_code: string;
      };
    }
  }
}

export interface RegisterRequest {
  phone: string;
  email?: string;
  firstName: string;
  lastName?: string;
  country_code: string;
  photo?: string;
  representing: string;
}

export interface LoginRequest {
  country_code: string;
  phone: string;
  otp: string;
}

export interface OTPRequest {
  phone: string;
  country_code: string;
  otp?: string;
}

export interface Establishment {
  id: number;
  user_id: number;
  name: string;
  address1: string;
  address2?: string;
  pincode: string;
  gst_number?: string;
  pan_number?: string;
  logo?: string;
  latitude?: number;
  longitude?: number;
  plan?: number;
  created_at: Date;
}

export interface Department {
  id: number;
  establishment_id: number;
  name: string;
}

export interface Gate {
  id: number;
  establishment_id: number;
  name: string;
  geofencing?: boolean;
  latitude?: number;
  longitude?: number;
  radius?: number;
}

export interface JWTPayload {
  id: number;
  phone: string;
  plan: number;
  country_code: string;
  iat?: number;
  exp?: number;
}
