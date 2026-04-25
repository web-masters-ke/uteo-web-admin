'use client';
import { redirect } from 'next/navigation';
export default function PayoutsRedirect() { redirect('/dashboard/payments?tab=payouts'); }
