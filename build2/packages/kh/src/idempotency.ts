export function idempotencyKey(scope: string, id: string): string {
	return `moat:${scope}:${id}`;
}
