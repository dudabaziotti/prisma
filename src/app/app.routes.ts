import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/auth.guards';
import { Shell } from './layout/shell';
import { CadastroPage } from './pages/cadastro/cadastro';
import { DisciplinasPage } from './pages/disciplinas/disciplinas';
import { FeedPage } from './pages/feed/feed';
import { LoginPage } from './pages/login/login';
import { NotificacoesPage } from './pages/notificacoes/notificacoes';
import { PerfilEditarPage } from './pages/perfil-editar/perfil-editar';
import { PerfilPage } from './pages/perfil/perfil';
import { RankingPage } from './pages/ranking/ranking';
import { SalaPage } from './pages/sala/sala';
import { SalasPage } from './pages/salas/salas';

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
      { path: 'salas', component: SalasPage, title: 'Salas de foco | Prisma' },
      { path: 'salas/:id', component: SalaPage, title: 'Sala de foco | Prisma' },
      { path: 'disciplinas', component: DisciplinasPage, title: 'Disciplinas | Prisma' },
      { path: 'ranking', component: RankingPage, title: 'Ranking semanal | Prisma' },
      { path: 'notificacoes', component: NotificacoesPage, title: 'Notificações | Prisma' },
    ],
  },
  { path: '**', redirectTo: '' },
];
