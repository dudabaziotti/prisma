import { Component, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/firebase-errors';

function passwordsMatch(group: AbstractControl): ValidationErrors | null {
  const { password, confirm } = group.value;
  return password && confirm && password !== confirm ? { mismatch: true } : null;
}

@Component({
  selector: 'app-cadastro',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './cadastro.html',
  styleUrl: '../auth-page.scss',
})
export class CadastroPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly form = inject(FormBuilder).nonNullable.group(
    {
      name: ['', [Validators.required, Validators.minLength(2), Validators.maxLength(60)]],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirm: ['', Validators.required],
    },
    { validators: passwordsMatch },
  );
  readonly submitted = signal(false);
  readonly loading = signal(false);
  readonly error = signal('');

  showError(field: 'name' | 'email' | 'password' | 'confirm'): boolean {
    return this.submitted() && this.form.controls[field].invalid;
  }

  async submit(): Promise<void> {
    this.submitted.set(true);
    this.error.set('');
    if (this.form.invalid) return;

    this.loading.set(true);
    try {
      const { name, email, password } = this.form.getRawValue();
      await this.auth.register(name.trim(), email.trim(), password);
      await this.router.navigate(['/feed']);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
