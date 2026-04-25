'use client';
import { redirect } from 'next/navigation';
export default function SubscriptionPlansRedirect() {
  redirect('/dashboard/subscriptions');
}
