// ============================================================================
// Shared crypto primitives — used by the OTP provider abstraction
// (otpProvider.ts's MockOtpProvider) so the audited CSPRNG/hash logic
// exists in exactly one place, kept separate from index.ts so it's easy to
// reuse if another provider or route ever needs the same primitives.
// ============================================================================

export async function sha256Hex(text: string): Promise<string> {
	const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

// Rejection sampling avoids modulo bias — every 6-digit code 000000-999999
// is equally likely. crypto.getRandomValues (not Math.random) is the CSPRNG
// available in the Workers runtime.
export function generateOtp(): string {
	const max = 1_000_000;
	const limit = Math.floor(0x100000000 / max) * max;
	let value: number;
	do {
		value = crypto.getRandomValues(new Uint32Array(1))[0];
	} while (value >= limit);
	return String(value % max).padStart(6, '0');
}
