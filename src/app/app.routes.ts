import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guards';
import { Shell } from './layout/shell';
import { CadastroPage } from './pages/cadastro/cadastro';
import { FeedPage } from './pages/feed/feed';
import { LoginPage } from './pages/login/login';
import { PerfilEditarPage } from './pages/perfil-editar/perfil-editar';
import { PerfilPage } from './pages/perfil/perfil';

export const routes: Routes = [
  { path: 'login', component: LoginPage, canActivate: [guestGuard], title: 'Entrar | Prisma' },
  { path: 'cadastro', component: CadastroPage, canActivate: [guestGuard], title: 'Cadastro | Prisma' },
  {
    path: '',
    component: Shell,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'feed' },
      { path: 'feed', component: FeedPage, title: 'Feed | Prisma' },
      { path: 'perfil/editar', component: PerfilEditarPage, title: 'Editar perfil | Prisma' },
      { path: 'perfil/:uid', component: PerfilPage, title: 'Perfil | Prisma' },
      { path: 'perfil', component: PerfilPage, title: 'Meu perfil | Prisma' },
    ],
  },
  { path: '**', redirectTo: '' },
];
