import { Component, effect, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/firebase-errors';
import { AVATARS, DEFAULT_AVATAR, avatarUrl, parseInterests } from '../../core/models';
import { UserService } from '../../core/user.service';

/** Edição de perfil (Update) e exclusão de conta (Delete). */
@Component({
  selector: 'app-perfil-editar',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './perfil-editar.html',
  styleUrl: './perfil-editar.scss',
})
export class PerfilEditarPage {
  private readonly auth = inject(AuthService);
  private readonly users = inject(UserService);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder).nonNullable;

  readonly avatars = AVATARS;
  readonly avatarUrl = avatarUrl;
  readonly profile = this.auth.profile;

  readonly form = this.fb.group({
    name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
    bio: ['', Validators.maxLength(300)],
    interests: [''],
    avatar: [DEFAULT_AVATAR as string],
  });
  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly error = signal('');

  // Exclusão de conta
  readonly deleteForm = this.fb.group({ password: ['', Validators.required] });
  readonly confirmingDelete = signal(false);
  readonly deleting = signal(false);
  readonly deleteError = signal('');

  private filled = false;

  constructor() {
    // Preenche o formulário assim que o perfil carregar.
    effect(() => {
      const p = this.profile();
      if (p && !this.filled) {
        this.filled = true;
        this.form.setValue({
          name: p.name,
          bio: p.bio,
          interests: p.interests.join(', '),
          avatar: p.avatar || DEFAULT_AVATAR,
        });
      }
    });
  }

  async save(): Promise<void> {
    this.submitted.set(true);
    this.error.set('');
    const uid = this.auth.uid();
    if (this.form.invalid || !uid) return;

    this.saving.set(true);
    try {
      const v = this.form.getRawValue();
      await this.users.updateProfile(uid, {
        name: v.name.trim(),
        bio: v.bio.trim(),
        interests: parseInterests(v.interests),
        avatar: v.avatar,
      });
      await this.router.navigate(['/perfil']);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.saving.set(false);
    }
  }

  async deleteAccount(): Promise<void> {
    this.deleteError.set('');
    if (this.deleteForm.invalid) {
      this.deleteError.set('Digite sua senha para confirmar.');
      return;
    }
    this.deleting.set(true);
    try {
      await this.auth.deleteAccount(this.deleteForm.getRawValue().password);
      await this.router.navigate(['/login'], { queryParams: { contaExcluida: 1 } });
    } catch (e) {
      this.deleteError.set(errorMessage(e));
      this.deleting.set(false);
    }
  }

  cancelDelete(): void {
    this.confirmingDelete.set(false);
    this.deleteForm.reset();
    this.deleteError.set('');
  }
}
