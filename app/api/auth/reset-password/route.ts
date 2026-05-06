import { NextResponse } from 'next/server';
import { checkEmailExists, resetUserPassword } from '../../../lib/pool-store';

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { email?: string; newPassword?: string };
    const email = body.email?.trim() ?? '';

    if (!email) {
      return NextResponse.json({ error: 'Email is required.' }, { status: 400 });
    }

    if (body.newPassword !== undefined) {
      await resetUserPassword(email, body.newPassword);
      return NextResponse.json({ success: true });
    }

    const exists = await checkEmailExists(email);
    return NextResponse.json({ exists });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Something went wrong.' },
      { status: 400 },
    );
  }
}
