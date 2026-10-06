// Storage key layout: everything about a client lives under `patients/<id>/` (profile photo,
// documents, posture photos), so deleting a client can wipe one folder.

const CLIENT_FOLDER = /^patients\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\/$/;

export const clientFolder = (patientId: string) => `patients/${patientId}/`;

/** Bulk deletes take exactly one client's folder: never '', 'patients/' or anything outside it. */
export function assertClientFolder(prefix: string): void {
  if (!CLIENT_FOLDER.test(prefix)) throw new Error(`Invalid storage prefix: ${prefix}`);
}
