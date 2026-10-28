import { Component, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { errorMessage } from '../../core/firebase-errors';

@Component({
  selector: 'app-login',
  imports: [ReactiveFormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: '../auth-page.scss',
})
export class LoginPage {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  /** Vem da URL (?contaExcluida=1) depois que o usuário exclui a conta. */
  readonly contaExcluida = input<string>();

  readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  readonly loading = signal(false);
  readonly error = signal('');

  async submit(): Promise<void> {
    if (this.form.invalid) {
      this.error.set('Informe um e-mail válido e a senha.');
      return;
    }
    this.loading.set(true);
    this.error.set('');
    try {
      const { email, password } = this.form.getRawValue();
      await this.auth.login(email.trim(), password);
      await this.router.navigate(['/feed']);
    } catch (e) {
      this.error.set(errorMessage(e));
    } finally {
      this.loading.set(false);
    }
  }
}
