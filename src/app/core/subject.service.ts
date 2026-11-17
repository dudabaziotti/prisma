import { Injectable } from '@angular/core';
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore';
import { Observable } from 'rxjs';
import { db } from './firebase';
import { Subject, SubjectInput, UserProfile } from './models';
import { toDate } from './user.service';

/** Catálogo de disciplinas: criar, listar, editar e excluir (CRUD completo). */
@Injectable({ providedIn: 'root' })
export class SubjectService {
  private readonly subjects = collection(db, 'subjects');

  watchAll(): Observable<Subject[]> {
    return new Observable<Subject[]>((subscriber) =>
      onSnapshot(
        query(this.subjects, orderBy('name', 'asc')),
        (snap) =>
          subscriber.next(
            snap.docs.map((d) => {
              const data = d.data({ serverTimestamps: 'estimate' });
              return {
                id: d.id,
                name: data['name'] ?? '',
                description: data['description'] ?? '',
                createdBy: data['createdBy'],
                createdByName: data['createdByName'] ?? '',
                createdAt: toDate(data['createdAt']),
                updatedAt: toDate(data['updatedAt']),
              };
            }),
          ),
        (err) => {
          console.warn('Falha ao carregar disciplinas:', err.code);
          subscriber.next([]);
        },
      ),
    );
  }

  async create(author: UserProfile, input: SubjectInput): Promise<void> {
    await addDoc(this.subjects, {
      name: input.name.trim(),
      description: input.description.trim(),
      createdBy: author.uid,
      createdByName: author.name,
      createdAt: serverTimestamp(),
      updatedAt: null,
    });
  }

  async update(id: string, input: SubjectInput): Promise<void> {
    await updateDoc(doc(this.subjects, id), {
      name: input.name.trim(),
      description: input.description.trim(),
      updatedAt: serverTimestamp(),
    });
  }

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(this.subjects, id));
  }
}

/** Compara nomes de disciplina ignorando maiúsculas, acentos e espaços nas pontas. */
export function sameSubjectName(a: string, b: string): boolean {
  const norm = (s: string) => s.trim().toLocaleLowerCase('pt-BR').normalize('NFD').replace(/[̀-ͯ]/g, '');
  return norm(a) === norm(b);
}
