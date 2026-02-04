import { NextResponse } from 'next/server';

type ApiResponse<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown };

export function successResponse<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json({ success: true, data }, { status });
}

export function errorResponse(
  message: string,
  status = 500,
  details?: unknown
): NextResponse<ApiResponse<null>> {
  return NextResponse.json({ success: false, error: message, details }, { status });
}

export function parseId(id: string | null | undefined): number | null {
  if (!id) return null;
  const num = Number(id);
  return Number.isFinite(num) && num > 0 ? num : null;
}
