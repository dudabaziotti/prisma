import { DocumentReference, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

export async function deleteRefs(refs: DocumentReference<any, any>[]): Promise<void> {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((ref) => batch.delete(ref));
    await batch.commit();
  }
}

export async function updateRefs(refs: DocumentReference<any, any>[], data: Record<string, unknown>): Promise<void> {
  for (let i = 0; i < refs.length; i += 400) {
    const batch = writeBatch(db);
    refs.slice(i, i + 400).forEach((ref) => batch.update(ref, data));
    await batch.commit();
  }
}